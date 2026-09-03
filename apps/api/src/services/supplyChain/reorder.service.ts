import { prisma } from "@repo/db";
import {
  Prisma,
  AlertSeverity,
  AlertStatus,
  LotStatus,
  StockAlertType,
  StockStatus,
  UserRole,
} from "@prisma/client";
import { nextDocumentNumber, SEQUENCE_KEYS } from "./numbering.service.js";
import { getAvailability, getIncomingQuantity } from "./stock.service.js";
import { ZERO, roundQuantity } from "./decimal.js";
import { createNotification } from "../../controllers/notification.controller.js";

export const SUPPLY_CHAIN_SETTINGS = {
  EXPIRY_WARNING_DAYS: "inventory.expiry_warning_days",
  ALERT_NOTIFY_ROLES: "inventory.alert_notify_roles",
  AUTO_REQUISITION_ENABLED: "inventory.auto_requisition_enabled",
} as const;

const SETTING_FALLBACKS: Record<string, string> = {
  [SUPPLY_CHAIN_SETTINGS.EXPIRY_WARNING_DAYS]: "30",
  [SUPPLY_CHAIN_SETTINGS.ALERT_NOTIFY_ROLES]: "ADMIN",
  [SUPPLY_CHAIN_SETTINGS.AUTO_REQUISITION_ENABLED]: "true",
};

async function readSettings(): Promise<Record<string, string>> {
  const rows = await prisma.globalSetting.findMany({
    where: { key: { in: Object.values(SUPPLY_CHAIN_SETTINGS) } },
  });
  const values = { ...SETTING_FALLBACKS };
  for (const row of rows) values[row.key] = row.value;
  return values;
}

export interface AlertEvaluationSummary {
  evaluatedRules: number;
  raised: number;
  resolved: number;
  requisitionsCreated: number;
  alerts: Array<{
    productId: number;
    productCode: string;
    warehouseId: number;
    warehouseCode: string;
    alertType: StockAlertType;
    severity: AlertSeverity;
    currentQuantity: string;
    thresholdQuantity: string;
    shortfallQuantity: string;
    message: string;
  }>;
}

function classify(
  available: Prisma.Decimal,
  projected: Prisma.Decimal,
  rule: {
    safetyStock: Prisma.Decimal;
    reorderPoint: Prisma.Decimal;
    maximumStock: Prisma.Decimal | null;
  }
): {
  type: StockAlertType;
  severity: AlertSeverity;
  threshold: Prisma.Decimal;
} | null {
  if (available.lessThanOrEqualTo(0)) {
    return {
      type: StockAlertType.STOCKOUT,
      severity: AlertSeverity.CRITICAL,
      threshold: ZERO,
    };
  }
  if (projected.lessThan(rule.safetyStock)) {
    return {
      type: StockAlertType.BELOW_SAFETY_STOCK,
      severity: AlertSeverity.HIGH,
      threshold: rule.safetyStock,
    };
  }
  if (projected.lessThanOrEqualTo(rule.reorderPoint)) {
    return {
      type: StockAlertType.REORDER_POINT,
      severity: AlertSeverity.MEDIUM,
      threshold: rule.reorderPoint,
    };
  }
  if (rule.maximumStock && available.greaterThan(rule.maximumStock)) {
    return {
      type: StockAlertType.OVERSTOCK,
      severity: AlertSeverity.LOW,
      threshold: rule.maximumStock,
    };
  }
  return null;
}

export async function evaluateStockAlerts(
  options: {
    warehouseId?: number | null;
    productIds?: number[];
    notify?: boolean;
  } = {}
): Promise<AlertEvaluationSummary> {
  const settings = await readSettings();
  const autoRequisitionEnabled =
    settings[SUPPLY_CHAIN_SETTINGS.AUTO_REQUISITION_ENABLED] === "true";

  const rules = await prisma.reorderRule.findMany({
    where: {
      isActive: true,
      ...(options.warehouseId ? { warehouseId: options.warehouseId } : {}),
      ...(options.productIds && options.productIds.length > 0
        ? { productId: { in: options.productIds } }
        : {}),
    },
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          uomId: true,
          standardCost: true,
        },
      },
      warehouse: { select: { id: true, code: true, name: true } },
      preferredSupplier: { select: { id: true, name: true } },
    },
  });

  const summary: AlertEvaluationSummary = {
    evaluatedRules: rules.length,
    raised: 0,
    resolved: 0,
    requisitionsCreated: 0,
    alerts: [],
  };

  if (rules.length === 0) return summary;

  const productIds = [...new Set(rules.map(rule => rule.productId))];
  const incomingByProduct = await getIncomingQuantity(
    productIds,
    options.warehouseId ?? null
  );

  const requisitionDrafts = new Map<
    number,
    Array<{
      productId: number;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      supplierId: number | null;
    }>
  >();

  for (const rule of rules) {
    const availabilityMap = await getAvailability(
      [rule.productId],
      rule.warehouseId
    );
    const position = availabilityMap.get(
      `${rule.productId}:${rule.warehouseId}`
    );
    const available = position?.available ?? ZERO;
    const onHand = position?.onHand ?? ZERO;
    const incoming = incomingByProduct.get(rule.productId) ?? ZERO;
    const projected = available.plus(incoming);

    const verdict = classify(available, projected, rule);

    const openAlerts = await prisma.stockAlert.findMany({
      where: {
        productId: rule.productId,
        warehouseId: rule.warehouseId,
        status: AlertStatus.OPEN,
      },
    });

    for (const alert of openAlerts) {
      const stillApplies =
        verdict?.type === alert.alertType ||
        alert.alertType === StockAlertType.EXPIRY_WARNING ||
        alert.alertType === StockAlertType.EXPIRED ||
        alert.alertType === StockAlertType.NEGATIVE_STOCK;
      if (!stillApplies) {
        await prisma.stockAlert.update({
          where: { id: alert.id },
          data: {
            status: AlertStatus.RESOLVED,
            resolvedAt: new Date(),
            resolutionNote: `Position recovered: ${available.toFixed(4)} available against a threshold of ${alert.thresholdQuantity.toFixed(4)}`,
          },
        });
        summary.resolved += 1;
      }
    }

    if (onHand.isNegative()) {
      const created = await upsertAlert({
        productId: rule.productId,
        warehouseId: rule.warehouseId,
        alertType: StockAlertType.NEGATIVE_STOCK,
        severity: AlertSeverity.CRITICAL,
        currentQuantity: onHand,
        thresholdQuantity: ZERO,
        shortfallQuantity: onHand.abs(),
        message: `${rule.product.code} shows negative on-hand (${onHand.toFixed(4)}) in ${rule.warehouse.code}; a receipt or count correction is needed`,
      });
      if (created) {
        summary.raised += 1;
        summary.alerts.push({
          productId: rule.productId,
          productCode: rule.product.code,
          warehouseId: rule.warehouseId,
          warehouseCode: rule.warehouse.code,
          alertType: StockAlertType.NEGATIVE_STOCK,
          severity: AlertSeverity.CRITICAL,
          currentQuantity: onHand.toFixed(4),
          thresholdQuantity: "0.0000",
          shortfallQuantity: onHand.abs().toFixed(4),
          message: created.message,
        });
      }
    }

    await prisma.reorderRule.update({
      where: { id: rule.id },
      data: { lastEvaluatedAt: new Date() },
    });

    if (!verdict) continue;

    const shortfall =
      verdict.type === StockAlertType.OVERSTOCK
        ? roundQuantity(available.minus(verdict.threshold))
        : roundQuantity(
            Prisma.Decimal.max(ZERO, verdict.threshold.minus(projected))
          );

    const message = buildAlertMessage(verdict.type, {
      productCode: rule.product.code,
      warehouseCode: rule.warehouse.code,
      available,
      projected,
      incoming,
      threshold: verdict.threshold,
    });

    const created = await upsertAlert({
      productId: rule.productId,
      warehouseId: rule.warehouseId,
      alertType: verdict.type,
      severity: verdict.severity,
      currentQuantity: available,
      thresholdQuantity: verdict.threshold,
      shortfallQuantity: shortfall,
      message,
    });

    if (created) {
      summary.raised += 1;
      summary.alerts.push({
        productId: rule.productId,
        productCode: rule.product.code,
        warehouseId: rule.warehouseId,
        warehouseCode: rule.warehouse.code,
        alertType: verdict.type,
        severity: verdict.severity,
        currentQuantity: available.toFixed(4),
        thresholdQuantity: verdict.threshold.toFixed(4),
        shortfallQuantity: shortfall.toFixed(4),
        message,
      });
    }

    const needsReplenishment =
      verdict.type === StockAlertType.STOCKOUT ||
      verdict.type === StockAlertType.BELOW_SAFETY_STOCK ||
      verdict.type === StockAlertType.REORDER_POINT;

    if (autoRequisitionEnabled && rule.autoRequisition && needsReplenishment) {
      const gap = roundQuantity(
        Prisma.Decimal.max(ZERO, verdict.threshold.minus(projected))
      );
      const quantity = roundQuantity(
        Prisma.Decimal.max(rule.reorderQuantity, gap)
      );
      if (quantity.greaterThan(0)) {
        const unitPrice = await resolveExpectedUnitPrice(
          rule.productId,
          rule.preferredSupplierId
        );
        const draft = requisitionDrafts.get(rule.warehouseId) ?? [];
        draft.push({
          productId: rule.productId,
          quantity,
          unitPrice,
          supplierId: rule.preferredSupplierId,
        });
        requisitionDrafts.set(rule.warehouseId, draft);
      }
    }
  }

  const expirySummary = await evaluateExpiryAlerts(
    Number(settings[SUPPLY_CHAIN_SETTINGS.EXPIRY_WARNING_DAYS]) || 30,
    options.warehouseId ?? null
  );
  summary.raised += expirySummary.raised;
  summary.alerts.push(...expirySummary.alerts);

  if (requisitionDrafts.size > 0) {
    summary.requisitionsCreated =
      await createReplenishmentRequisitions(requisitionDrafts);
  }

  if (options.notify !== false && summary.raised > 0) {
    await notifyStockAlerts(
      settings[SUPPLY_CHAIN_SETTINGS.ALERT_NOTIFY_ROLES] ?? "",
      summary
    );
  }

  return summary;
}

function buildAlertMessage(
  type: StockAlertType,
  context: {
    productCode: string;
    warehouseCode: string;
    available: Prisma.Decimal;
    projected: Prisma.Decimal;
    incoming: Prisma.Decimal;
    threshold: Prisma.Decimal;
  }
): string {
  const incomingNote = context.incoming.greaterThan(0)
    ? ` (${context.incoming.toFixed(4)} already on order)`
    : "";
  switch (type) {
    case StockAlertType.STOCKOUT:
      return `${context.productCode} is out of stock in ${context.warehouseCode}${incomingNote}`;
    case StockAlertType.BELOW_SAFETY_STOCK:
      return `${context.productCode} in ${context.warehouseCode} is below safety stock: ${context.projected.toFixed(4)} projected against ${context.threshold.toFixed(4)} required${incomingNote}`;
    case StockAlertType.REORDER_POINT:
      return `${context.productCode} in ${context.warehouseCode} has reached its reorder point: ${context.projected.toFixed(4)} projected against ${context.threshold.toFixed(4)}${incomingNote}`;
    case StockAlertType.OVERSTOCK:
      return `${context.productCode} in ${context.warehouseCode} exceeds its maximum stock level: ${context.available.toFixed(4)} on hand against a maximum of ${context.threshold.toFixed(4)}`;
    default:
      return `${context.productCode} in ${context.warehouseCode} requires attention`;
  }
}

async function upsertAlert(input: {
  productId: number;
  warehouseId: number;
  alertType: StockAlertType;
  severity: AlertSeverity;
  currentQuantity: Prisma.Decimal;
  thresholdQuantity: Prisma.Decimal;
  shortfallQuantity: Prisma.Decimal;
  message: string;
  lotId?: number | null;
}) {
  const existing = await prisma.stockAlert.findFirst({
    where: {
      productId: input.productId,
      warehouseId: input.warehouseId,
      alertType: input.alertType,
      status: AlertStatus.OPEN,
    },
  });

  if (existing) {
    await prisma.stockAlert.update({
      where: { id: existing.id },
      data: {
        severity: input.severity,
        currentQuantity: input.currentQuantity,
        thresholdQuantity: input.thresholdQuantity,
        shortfallQuantity: input.shortfallQuantity,
        message: input.message,
      },
    });
    return null;
  }

  try {
    return await prisma.stockAlert.create({
      data: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        alertType: input.alertType,
        severity: input.severity,
        currentQuantity: input.currentQuantity,
        thresholdQuantity: input.thresholdQuantity,
        shortfallQuantity: input.shortfallQuantity,
        message: input.message,
        lotId: input.lotId ?? null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return null;
    }
    throw error;
  }
}

export async function evaluateExpiryAlerts(
  warningDays: number,
  warehouseId?: number | null
) {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setUTCDate(horizon.getUTCDate() + warningDays);

  const balances = await prisma.stockBalance.findMany({
    where: {
      quantity: { gt: 0 },
      status: StockStatus.AVAILABLE,
      ...(warehouseId ? { warehouseId } : {}),
      lot: {
        expiryDate: { not: null, lte: horizon },
        status: { not: LotStatus.CONSUMED },
      },
    },
    include: {
      lot: true,
      product: { select: { id: true, code: true, name: true } },
      warehouse: { select: { id: true, code: true } },
    },
  });

  const alerts: AlertEvaluationSummary["alerts"] = [];
  let raised = 0;

  const grouped = new Map<string, (typeof balances)[number][]>();
  for (const balance of balances) {
    const key = `${balance.productId}:${balance.warehouseId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), balance]);
  }

  for (const group of grouped.values()) {
    const first = group[0];
    if (!first) continue;
    const expired = group.filter(
      balance => balance.lot.expiryDate && balance.lot.expiryDate <= now
    );
    const target = expired.length > 0 ? expired : group;
    const quantity = target.reduce(
      (acc, balance) => acc.plus(balance.quantity),
      ZERO
    );
    const earliest = target
      .map(balance => balance.lot)
      .sort(
        (a, b) =>
          (a.expiryDate?.getTime() ?? 0) - (b.expiryDate?.getTime() ?? 0)
      )[0];
    if (!earliest?.expiryDate) continue;

    const isExpired = expired.length > 0;
    const alertType = isExpired
      ? StockAlertType.EXPIRED
      : StockAlertType.EXPIRY_WARNING;
    const daysOut = Math.ceil(
      (earliest.expiryDate.getTime() - now.getTime()) / 86_400_000
    );
    const message = isExpired
      ? `${first.product.code}: ${quantity.toFixed(4)} units expired in ${first.warehouse.code} (lot ${earliest.lotNumber}, expired ${earliest.expiryDate.toISOString().slice(0, 10)})`
      : `${first.product.code}: ${quantity.toFixed(4)} units expire within ${daysOut} day(s) in ${first.warehouse.code} (lot ${earliest.lotNumber})`;

    if (isExpired && earliest.status !== LotStatus.EXPIRED) {
      await prisma.stockLot.update({
        where: { id: earliest.id },
        data: { status: LotStatus.EXPIRED },
      });
    }

    const created = await upsertAlert({
      productId: first.productId,
      warehouseId: first.warehouseId,
      alertType,
      severity: isExpired ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
      currentQuantity: quantity,
      thresholdQuantity: ZERO,
      shortfallQuantity: ZERO,
      message,
      lotId: earliest.id,
    });

    if (created) {
      raised += 1;
      alerts.push({
        productId: first.productId,
        productCode: first.product.code,
        warehouseId: first.warehouseId,
        warehouseCode: first.warehouse.code,
        alertType,
        severity: isExpired ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
        currentQuantity: quantity.toFixed(4),
        thresholdQuantity: "0.0000",
        shortfallQuantity: "0.0000",
        message,
      });
    }
  }

  return { raised, alerts };
}

async function resolveExpectedUnitPrice(
  productId: number,
  supplierId: number | null
): Promise<Prisma.Decimal> {
  const now = new Date();
  const catalogue = await prisma.supplierProduct.findFirst({
    where: {
      productId,
      isActive: true,
      ...(supplierId ? { supplierId } : {}),
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    },
    orderBy: [{ isPreferred: "desc" }, { unitPrice: "asc" }],
  });
  if (catalogue) return catalogue.unitPrice;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { standardCost: true },
  });
  return product?.standardCost ?? ZERO;
}

async function createReplenishmentRequisitions(
  drafts: Map<
    number,
    Array<{
      productId: number;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      supplierId: number | null;
    }>
  >
): Promise<number> {
  const systemUser = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN, deletedAt: null },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (!systemUser) return 0;

  let created = 0;

  for (const [warehouseId, lines] of drafts.entries()) {
    const pendingLines = await prisma.purchaseRequisitionLine.findMany({
      where: {
        productId: { in: lines.map(line => line.productId) },
        requisition: {
          warehouseId,
          status: {
            in: [
              "DRAFT",
              "PENDING_APPROVAL",
              "APPROVED",
              "PARTIALLY_CONVERTED",
            ],
          },
        },
      },
      select: { productId: true },
    });
    const alreadyCovered = new Set(pendingLines.map(line => line.productId));
    const outstanding = lines.filter(
      line => !alreadyCovered.has(line.productId)
    );
    if (outstanding.length === 0) continue;

    await prisma.$transaction(async tx => {
      const requisitionNumber = await nextDocumentNumber(
        tx,
        SEQUENCE_KEYS.PURCHASE_REQUISITION
      );
      const estimatedValue = outstanding.reduce(
        (acc, line) => acc.plus(line.quantity.times(line.unitPrice)),
        ZERO
      );
      const suggestedSupplierId =
        outstanding.find(line => line.supplierId)?.supplierId ?? null;

      await tx.purchaseRequisition.create({
        data: {
          requisitionNumber,
          warehouseId,
          origin: "REORDER_RULE",
          status: "DRAFT",
          suggestedSupplierId,
          estimatedValue: estimatedValue.toDecimalPlaces(2),
          justification:
            "Raised automatically because stock reached the configured reorder point",
          requestedById: systemUser.id,
          lines: {
            create: outstanding.map(line => ({
              productId: line.productId,
              quantity: line.quantity,
              estimatedUnitPrice: line.unitPrice,
            })),
          },
        },
      });
      created += 1;
    });
  }

  return created;
}

async function notifyStockAlerts(
  rolesSetting: string,
  summary: AlertEvaluationSummary
): Promise<void> {
  const roles = rolesSetting
    .split(",")
    .map(role => role.trim())
    .filter((role): role is UserRole => role === "ADMIN" || role === "SALES");
  if (roles.length === 0) return;

  const recipients = await prisma.user.findMany({
    where: { role: { in: roles }, deletedAt: null },
    select: { id: true },
  });

  const critical = summary.alerts.filter(
    alert =>
      alert.severity === AlertSeverity.CRITICAL ||
      alert.severity === AlertSeverity.HIGH
  );
  const headline =
    critical.length > 0
      ? `${critical.length} critical stock alert(s) need attention`
      : `${summary.raised} new stock alert(s) raised`;

  await Promise.allSettled(
    recipients.map(recipient =>
      createNotification({
        userId: recipient.id,
        type: "STOCK_ALERT",
        title: "Inventory alerts",
        message: headline,
        link: "/inventory/alerts",
      })
    )
  );
}

export async function acknowledgeAlert(
  alertId: number,
  userId: number,
  note?: string | null
) {
  return prisma.stockAlert.update({
    where: { id: alertId },
    data: {
      status: AlertStatus.ACKNOWLEDGED,
      acknowledgedById: userId,
      acknowledgedAt: new Date(),
      resolutionNote: note ?? null,
    },
  });
}

export async function resolveAlert(alertId: number, note?: string | null) {
  return prisma.stockAlert.update({
    where: { id: alertId },
    data: {
      status: AlertStatus.RESOLVED,
      resolvedAt: new Date(),
      resolutionNote: note ?? null,
    },
  });
}
