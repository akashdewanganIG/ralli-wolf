import { prisma } from "@repo/db";
import { Prisma, PurchaseOrderStatus } from "@prisma/client";
import { ZERO, percentageOf, roundMoney, roundQuantity } from "./decimal.js";

/**
 * Weighting used to combine the individual KPIs into one score. It is exposed
 * so the UI can explain the number instead of showing an opaque rating.
 */
export const SCORE_WEIGHTS = {
  onTimeDelivery: 0.35,
  quality: 0.35,
  fillRate: 0.2,
  priceStability: 0.1,
} as const;

export interface SupplierScorecard {
  supplierId: number;
  supplierCode: string;
  supplierName: string;
  periodStart: Date;
  periodEnd: Date;
  totalOrders: number;
  totalOrderValue: Prisma.Decimal;
  receiptsCount: number;
  onTimeReceipts: number;
  lateReceipts: number;
  onTimeDeliveryRate: Prisma.Decimal;
  receivedQuantity: Prisma.Decimal;
  acceptedQuantity: Prisma.Decimal;
  rejectedQuantity: Prisma.Decimal;
  qualityAcceptanceRate: Prisma.Decimal;
  averageLeadTimeDays: Prisma.Decimal;
  priceVariancePercent: Prisma.Decimal;
  fillRate: Prisma.Decimal;
  overallScore: Prisma.Decimal;
  /** True when the window contains no receipts, so the score means nothing yet. */
  hasData: boolean;
}

/**
 * Compute a supplier's KPIs for a period.
 *
 * Every figure comes from posted purchase orders and goods receipts:
 *
 *  - on-time delivery — receipts flagged on time against the promised date;
 *  - quality — accepted units over received units, after inspection;
 *  - fill rate — units received against units ordered on closed lines;
 *  - price variance — what was invoiced against what was ordered;
 *  - lead time — order date to receipt date, in days.
 *
 * When a supplier has no receipts in the window, `hasData` is false and the
 * score is zero — an unrated supplier is not the same as a bad one, and the
 * UI is expected to say so rather than showing a misleading 0%.
 */
export async function computeSupplierScorecard(
  supplierId: number,
  periodStart: Date,
  periodEnd: Date
): Promise<SupplierScorecard> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, code: true, name: true },
  });
  if (!supplier) {
    throw new Error(`Supplier ${supplierId} not found`);
  }

  const orders = await prisma.purchaseOrder.findMany({
    where: {
      supplierId,
      orderDate: { gte: periodStart, lte: periodEnd },
      status: {
        notIn: [
          PurchaseOrderStatus.DRAFT,
          PurchaseOrderStatus.CANCELLED,
          PurchaseOrderStatus.REJECTED,
        ],
      },
    },
    include: { lines: true },
  });

  const receipts = await prisma.goodsReceiptNote.findMany({
    where: {
      supplierId,
      receivedDate: { gte: periodStart, lte: periodEnd },
      status: { not: "CANCELLED" },
    },
    include: { lines: true, purchaseOrder: { select: { orderDate: true } } },
  });

  const totalOrderValue = orders.reduce(
    (acc, order) => acc.plus(order.grandTotal),
    ZERO
  );

  const ratedReceipts = receipts.filter(receipt => receipt.isOnTime !== null);
  const onTimeReceipts = ratedReceipts.filter(
    receipt => receipt.isOnTime === true
  ).length;
  const lateReceipts = ratedReceipts.length - onTimeReceipts;

  const receivedQuantity = receipts.reduce(
    (acc, receipt) => acc.plus(receipt.totalReceivedQuantity),
    ZERO
  );
  const acceptedQuantity = receipts.reduce(
    (acc, receipt) => acc.plus(receipt.totalAcceptedQuantity),
    ZERO
  );
  const rejectedQuantity = receipts.reduce(
    (acc, receipt) => acc.plus(receipt.totalRejectedQuantity),
    ZERO
  );

  // Lead time: only receipts we can tie back to an order date can be measured.
  const leadTimes = receipts
    .filter(receipt => receipt.purchaseOrder?.orderDate)
    .map(receipt =>
      Math.max(
        0,
        Math.round(
          (receipt.receivedDate.getTime() -
            (
              receipt.purchaseOrder as { orderDate: Date }
            ).orderDate.getTime()) /
            86_400_000
        )
      )
    );
  const averageLeadTimeDays =
    leadTimes.length > 0
      ? new Prisma.Decimal(leadTimes.reduce((acc, days) => acc + days, 0))
          .dividedBy(leadTimes.length)
          .toDecimalPlaces(2)
      : ZERO;

  // Fill rate over lines that are no longer open.
  const settledLines = orders.flatMap(order =>
    order.lines.filter(
      line => line.status === "RECEIVED" || line.status === "PARTIALLY_RECEIVED"
    )
  );
  const orderedOnSettled = settledLines.reduce(
    (acc, line) => acc.plus(line.quantity),
    ZERO
  );
  const receivedOnSettled = settledLines.reduce(
    (acc, line) => acc.plus(line.receivedQuantity),
    ZERO
  );
  const fillRate = percentageOf(receivedOnSettled, orderedOnSettled);

  // Price variance: invoiced cost against ordered cost on matched lines.
  let orderedValue = ZERO;
  let invoicedValue = ZERO;
  for (const receipt of receipts) {
    for (const line of receipt.lines) {
      if (!line.purchaseOrderLineId) continue;
      const poLine = orders
        .flatMap(order => order.lines)
        .find(entry => entry.id === line.purchaseOrderLineId);
      if (!poLine) continue;
      orderedValue = orderedValue.plus(
        line.receivedQuantity.times(poLine.unitPrice)
      );
      invoicedValue = invoicedValue.plus(
        line.receivedQuantity.times(line.unitCost)
      );
    }
  }
  const priceVariancePercent = orderedValue.isZero()
    ? ZERO
    : invoicedValue
        .minus(orderedValue)
        .dividedBy(orderedValue)
        .times(100)
        .toDecimalPlaces(4);

  const onTimeDeliveryRate =
    ratedReceipts.length > 0
      ? percentageOf(
          new Prisma.Decimal(onTimeReceipts),
          new Prisma.Decimal(ratedReceipts.length)
        )
      : ZERO;
  const qualityAcceptanceRate = percentageOf(
    acceptedQuantity,
    receivedQuantity
  );

  const hasData = receipts.length > 0;

  // Price stability scores 100 at no variance and decays as the supplier
  // drifts from the agreed price in either direction.
  const priceStabilityScore = Prisma.Decimal.max(
    ZERO,
    new Prisma.Decimal(100).minus(priceVariancePercent.abs().times(2))
  );

  const overallScore = hasData
    ? onTimeDeliveryRate
        .times(SCORE_WEIGHTS.onTimeDelivery)
        .plus(qualityAcceptanceRate.times(SCORE_WEIGHTS.quality))
        .plus(fillRate.times(SCORE_WEIGHTS.fillRate))
        .plus(priceStabilityScore.times(SCORE_WEIGHTS.priceStability))
        .toDecimalPlaces(4)
    : ZERO;

  return {
    supplierId: supplier.id,
    supplierCode: supplier.code,
    supplierName: supplier.name,
    periodStart,
    periodEnd,
    totalOrders: orders.length,
    totalOrderValue: roundMoney(totalOrderValue),
    receiptsCount: receipts.length,
    onTimeReceipts,
    lateReceipts,
    onTimeDeliveryRate,
    receivedQuantity: roundQuantity(receivedQuantity),
    acceptedQuantity: roundQuantity(acceptedQuantity),
    rejectedQuantity: roundQuantity(rejectedQuantity),
    qualityAcceptanceRate,
    averageLeadTimeDays,
    priceVariancePercent,
    fillRate,
    overallScore,
    hasData,
  };
}

/** Persist a scorecard so trends can be charted over time. */
export async function snapshotSupplierPerformance(
  supplierId: number,
  periodStart: Date,
  periodEnd: Date
) {
  const scorecard = await computeSupplierScorecard(
    supplierId,
    periodStart,
    periodEnd
  );

  return prisma.supplierPerformance.upsert({
    where: {
      supplierId_periodStart_periodEnd: { supplierId, periodStart, periodEnd },
    },
    create: {
      supplierId,
      periodStart,
      periodEnd,
      totalOrders: scorecard.totalOrders,
      totalOrderValue: scorecard.totalOrderValue,
      receiptsCount: scorecard.receiptsCount,
      onTimeReceipts: scorecard.onTimeReceipts,
      lateReceipts: scorecard.lateReceipts,
      onTimeDeliveryRate: scorecard.onTimeDeliveryRate,
      receivedQuantity: scorecard.receivedQuantity,
      acceptedQuantity: scorecard.acceptedQuantity,
      rejectedQuantity: scorecard.rejectedQuantity,
      qualityAcceptanceRate: scorecard.qualityAcceptanceRate,
      averageLeadTimeDays: scorecard.averageLeadTimeDays,
      priceVariancePercent: scorecard.priceVariancePercent,
      fillRate: scorecard.fillRate,
      overallScore: scorecard.overallScore,
    },
    update: {
      totalOrders: scorecard.totalOrders,
      totalOrderValue: scorecard.totalOrderValue,
      receiptsCount: scorecard.receiptsCount,
      onTimeReceipts: scorecard.onTimeReceipts,
      lateReceipts: scorecard.lateReceipts,
      onTimeDeliveryRate: scorecard.onTimeDeliveryRate,
      receivedQuantity: scorecard.receivedQuantity,
      acceptedQuantity: scorecard.acceptedQuantity,
      rejectedQuantity: scorecard.rejectedQuantity,
      qualityAcceptanceRate: scorecard.qualityAcceptanceRate,
      averageLeadTimeDays: scorecard.averageLeadTimeDays,
      priceVariancePercent: scorecard.priceVariancePercent,
      fillRate: scorecard.fillRate,
      overallScore: scorecard.overallScore,
      computedAt: new Date(),
    },
  });
}

/** Rank suppliers for a period; used by the supplier league table. */
export async function rankSuppliers(
  periodStart: Date,
  periodEnd: Date,
  limit = 50
) {
  const suppliers = await prisma.supplier.findMany({
    where: { status: { in: ["ACTIVE", "ON_HOLD"] } },
    select: { id: true },
    take: limit,
  });

  const scorecards = await Promise.all(
    suppliers.map(supplier =>
      computeSupplierScorecard(supplier.id, periodStart, periodEnd)
    )
  );

  return scorecards
    .filter(scorecard => scorecard.hasData)
    .sort((a, b) => b.overallScore.comparedTo(a.overallScore));
}

/** Purchase orders that are late or due soon, for the buyer's follow-up list. */
export async function getDeliveryWatchlist(
  options: { warehouseId?: number | null; daysAhead?: number } = {}
) {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setUTCDate(horizon.getUTCDate() + (options.daysAhead ?? 7));

  const orders = await prisma.purchaseOrder.findMany({
    where: {
      status: {
        in: [
          PurchaseOrderStatus.APPROVED,
          PurchaseOrderStatus.SENT,
          PurchaseOrderStatus.ACKNOWLEDGED,
          PurchaseOrderStatus.PARTIALLY_RECEIVED,
        ],
      },
      ...(options.warehouseId ? { warehouseId: options.warehouseId } : {}),
      OR: [
        { promisedDate: { lte: horizon } },
        { expectedDeliveryDate: { lte: horizon } },
      ],
    },
    include: {
      supplier: { select: { id: true, code: true, name: true } },
      warehouse: { select: { id: true, code: true, name: true } },
      lines: { select: { quantity: true, receivedQuantity: true } },
    },
    orderBy: [{ promisedDate: "asc" }, { expectedDeliveryDate: "asc" }],
  });

  return orders.map(order => {
    const dueDate = order.promisedDate ?? order.expectedDeliveryDate;
    const daysLate = dueDate
      ? Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000)
      : 0;
    const ordered = order.lines.reduce(
      (acc, line) => acc.plus(line.quantity),
      ZERO
    );
    const received = order.lines.reduce(
      (acc, line) => acc.plus(line.receivedQuantity),
      ZERO
    );

    return {
      id: order.id,
      poNumber: order.poNumber,
      supplier: order.supplier,
      warehouse: order.warehouse,
      status: order.status,
      orderDate: order.orderDate,
      dueDate,
      daysLate: daysLate > 0 ? daysLate : 0,
      isOverdue: daysLate > 0,
      grandTotal: order.grandTotal,
      orderedQuantity: roundQuantity(ordered),
      receivedQuantity: roundQuantity(received),
      outstandingQuantity: roundQuantity(ordered.minus(received)),
      completionPercent: percentageOf(received, ordered),
    };
  });
}
