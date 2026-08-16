import { prisma } from "@repo/db";
import { Prisma, ItemType, StockMovementType } from "@prisma/client";
import { explodeBom } from "./bom.service.js";
import {
  getAvailability,
  getIncomingQuantity,
  issueStock,
  sortLockOrder,
} from "./stock.service.js";
import { DomainError, NotFoundError } from "./errors.js";
import {
  ZERO,
  percentageOf,
  roundCost,
  roundQuantity,
  toDecimal,
} from "./decimal.js";

type Tx = Prisma.TransactionClient;

/** Item types that the Material Management module is responsible for. */
export const MATERIAL_ITEM_TYPES: ItemType[] = [
  ItemType.RAW_MATERIAL,
  ItemType.COMPONENT,
  ItemType.CONSUMABLE,
  ItemType.PACKAGING,
];

export interface ShortageLine {
  productId: number;
  productCode: string;
  productName: string;
  itemType: string;
  uomCode: string | null;
  requiredQuantity: Prisma.Decimal;
  onHandQuantity: Prisma.Decimal;
  reservedQuantity: Prisma.Decimal;
  availableQuantity: Prisma.Decimal;
  incomingQuantity: Prisma.Decimal;
  safetyStock: Prisma.Decimal;
  /** Positive when there is not enough free stock to cover the build. */
  shortfallQuantity: Prisma.Decimal;
  /** Shortfall once stock already on order is taken into account. */
  netShortfallQuantity: Prisma.Decimal;
  coveragePercent: Prisma.Decimal;
  isShort: boolean;
  substitutes: Array<{
    productId: number;
    productCode: string;
    productName: string;
    priority: number;
    conversionFactor: Prisma.Decimal;
    availableQuantity: Prisma.Decimal;
    /** Units of the original component this substitute could cover. */
    coverableQuantity: Prisma.Decimal;
  }>;
}

/**
 * Can we build `quantity` of this product from stock on hand?
 *
 * The BOM is exploded to its leaves, demand for a component appearing in
 * several branches is summed, and each line is compared against free stock in
 * the target warehouse. Safety stock is reported but not netted off, so a
 * planner can see both "can I build it" and "would building it eat my buffer".
 */
export async function checkMaterialAvailability(input: {
  productId: number;
  bomId?: number | null;
  quantity: Prisma.Decimal | number | string;
  warehouseId?: number | null;
  includeSubstitutes?: boolean;
}): Promise<{
  productId: number;
  bomId: number;
  bomNumber: string;
  requestedQuantity: Prisma.Decimal;
  /** Largest whole build the current free stock supports. */
  buildableQuantity: Prisma.Decimal;
  canBuild: boolean;
  totalMaterialCost: Prisma.Decimal;
  lines: ShortageLine[];
}> {
  const quantity = toDecimal(input.quantity, "quantity");
  if (quantity.lessThanOrEqualTo(0)) {
    throw new DomainError("quantity must be greater than zero", {
      code: "VALIDATION_ERROR",
    });
  }

  const { bom, components } = await explodeBom({
    productId: input.productId,
    bomId: input.bomId,
    quantity,
  });

  // Only leaf components consume stock; a sub-assembly with its own BOM is
  // represented by its children.
  const leaves = components.filter(
    component => !component.hasChildBom && !component.isPhantom
  );

  const demand = new Map<
    number,
    {
      productId: number;
      productCode: string;
      productName: string;
      itemType: string;
      uomCode: string | null;
      quantity: Prisma.Decimal;
      substitutes: ShortageLine["substitutes"];
    }
  >();

  for (const leaf of leaves) {
    const existing = demand.get(leaf.productId);
    if (existing) {
      existing.quantity = existing.quantity.plus(leaf.requiredQuantity);
    } else {
      demand.set(leaf.productId, {
        productId: leaf.productId,
        productCode: leaf.productCode,
        productName: leaf.productName,
        itemType: leaf.itemType,
        uomCode: leaf.uomCode,
        quantity: leaf.requiredQuantity,
        substitutes: leaf.substitutes.map(substitute => ({
          ...substitute,
          availableQuantity: ZERO,
          coverableQuantity: ZERO,
        })),
      });
    }
  }

  const componentIds = [...demand.keys()];
  const substituteIds = input.includeSubstitutes
    ? [
        ...new Set(
          [...demand.values()].flatMap(entry =>
            entry.substitutes.map(s => s.productId)
          )
        ),
      ]
    : [];

  const allIds = [...new Set([...componentIds, ...substituteIds])];
  const availability = await getAvailability(allIds, input.warehouseId ?? null);
  const incoming = await getIncomingQuantity(
    componentIds,
    input.warehouseId ?? null
  );

  const rules = await prisma.reorderRule.findMany({
    where: {
      productId: { in: componentIds },
      ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}),
      isActive: true,
    },
    select: { productId: true, safetyStock: true },
  });
  const safetyByProduct = new Map(
    rules.map(rule => [rule.productId, rule.safetyStock])
  );

  const lines: ShortageLine[] = [];
  let limitingRatio: Prisma.Decimal | null = null;

  for (const entry of demand.values()) {
    const position = availability.get(
      `${entry.productId}:${input.warehouseId ?? 0}`
    );
    const onHand = position?.onHand ?? ZERO;
    const reserved = position?.reserved ?? ZERO;
    const available = position?.available ?? ZERO;
    const incomingQuantity = incoming.get(entry.productId) ?? ZERO;
    const safetyStock = safetyByProduct.get(entry.productId) ?? ZERO;

    const shortfall = roundQuantity(
      Prisma.Decimal.max(ZERO, entry.quantity.minus(available))
    );
    const netShortfall = roundQuantity(
      Prisma.Decimal.max(
        ZERO,
        entry.quantity.minus(available.plus(incomingQuantity))
      )
    );

    const substitutes = input.includeSubstitutes
      ? entry.substitutes.map(substitute => {
          const substitutePosition = availability.get(
            `${substitute.productId}:${input.warehouseId ?? 0}`
          );
          const substituteAvailable = substitutePosition?.available ?? ZERO;
          const coverable = substitute.conversionFactor.isZero()
            ? ZERO
            : roundQuantity(
                substituteAvailable.dividedBy(substitute.conversionFactor)
              );
          return {
            ...substitute,
            availableQuantity: substituteAvailable,
            coverableQuantity: coverable,
          };
        })
      : entry.substitutes;

    // How many complete builds this one line supports.
    const perBuild = entry.quantity.dividedBy(quantity);
    const ratio = perBuild.isZero() ? null : available.dividedBy(perBuild);
    if (
      ratio !== null &&
      (limitingRatio === null || ratio.lessThan(limitingRatio))
    ) {
      limitingRatio = ratio;
    }

    lines.push({
      productId: entry.productId,
      productCode: entry.productCode,
      productName: entry.productName,
      itemType: entry.itemType,
      uomCode: entry.uomCode,
      requiredQuantity: roundQuantity(entry.quantity),
      onHandQuantity: onHand,
      reservedQuantity: reserved,
      availableQuantity: available,
      incomingQuantity,
      safetyStock,
      shortfallQuantity: shortfall,
      netShortfallQuantity: netShortfall,
      coveragePercent: percentageOf(
        Prisma.Decimal.min(available, entry.quantity),
        entry.quantity
      ),
      isShort: shortfall.greaterThan(0),
      substitutes,
    });
  }

  const buildableQuantity =
    limitingRatio === null
      ? quantity
      : roundQuantity(Prisma.Decimal.max(ZERO, limitingRatio.floor()));

  const totalMaterialCost = roundCost(
    lines.reduce((acc, line) => {
      const component = leaves.find(leaf => leaf.productId === line.productId);
      return acc.plus(line.requiredQuantity.times(component?.unitCost ?? ZERO));
    }, ZERO)
  );

  return {
    productId: input.productId,
    bomId: bom.id,
    bomNumber: bom.bomNumber,
    requestedQuantity: quantity,
    buildableQuantity,
    canBuild: lines.every(line => !line.isShort),
    totalMaterialCost,
    lines,
  };
}

export interface IssueMaterialLine {
  productId: number;
  quantity: Prisma.Decimal | number | string;
  /** CONSUMED (used in the build) or WASTED (scrapped). */
  consumptionType?: "CONSUMED" | "WASTED";
  reasonCode?: string | null;
  binId?: number | null;
  lotId?: number | null;
}

/**
 * Issue material out of stock against a requisition or production order.
 *
 * Every issue is posted through the stock engine, so it consumes real cost
 * layers and lands in the ledger. Consumption and wastage are separated at
 * the point of issue, which is what makes the wastage report meaningful
 * instead of a guess derived from a variance.
 */
export async function issueMaterial(
  tx: Tx,
  input: {
    warehouseId: number;
    lines: IssueMaterialLine[];
    reference: { type: string; id?: number | null; number?: string | null };
    productionOrderId?: number | null;
    performedById?: number | null;
    notes?: string | null;
  }
) {
  if (input.lines.length === 0) {
    throw new DomainError("At least one line is required", {
      code: "VALIDATION_ERROR",
    });
  }

  const results: Array<{
    productId: number;
    quantity: Prisma.Decimal;
    totalCost: Prisma.Decimal;
    consumptionType: "CONSUMED" | "WASTED";
    allocations: Array<{
      lotId: number;
      lotNumber: string;
      quantity: Prisma.Decimal;
      unitCost: Prisma.Decimal;
    }>;
  }> = [];

  // Deterministic order keeps concurrent issues from deadlocking.
  for (const line of sortLockOrder(
    input.lines.map(line => ({ ...line, productId: line.productId }))
  )) {
    const consumptionType = line.consumptionType ?? "CONSUMED";
    const quantity = toDecimal(line.quantity, "quantity");
    if (quantity.lessThanOrEqualTo(0)) continue;

    const issued = await issueStock(tx, {
      productId: line.productId,
      warehouseId: input.warehouseId,
      quantity,
      binId: line.binId ?? null,
      lotId: line.lotId ?? null,
      movementType:
        consumptionType === "WASTED"
          ? StockMovementType.SCRAP
          : StockMovementType.PRODUCTION_CONSUMPTION,
      reference: input.reference,
      reasonCode: line.reasonCode ?? consumptionType,
      notes: input.notes ?? null,
      performedById: input.performedById ?? null,
    });

    if (input.productionOrderId) {
      for (const allocation of issued.allocations) {
        await tx.productionOrderConsumption.create({
          data: {
            productionOrderId: input.productionOrderId,
            lotId: allocation.lotId,
            quantity: allocation.quantity,
            consumptionType,
            unitCost: allocation.unitCost,
            totalCost: allocation.totalCost,
            reasonCode: line.reasonCode ?? null,
          },
        });
      }

      const component = await tx.productionOrderComponent.findFirst({
        where: {
          productionOrderId: input.productionOrderId,
          productId: line.productId,
        },
      });
      if (component) {
        await tx.productionOrderComponent.update({
          where: { id: component.id },
          data: {
            issuedQuantity: roundQuantity(
              component.issuedQuantity.plus(issued.totalQuantity)
            ),
            ...(consumptionType === "WASTED"
              ? {
                  wastedQuantity: roundQuantity(
                    component.wastedQuantity.plus(issued.totalQuantity)
                  ),
                }
              : {
                  consumedQuantity: roundQuantity(
                    component.consumedQuantity.plus(issued.totalQuantity)
                  ),
                }),
          },
        });
      }

      const order = await tx.productionOrder.findUnique({
        where: { id: input.productionOrderId },
      });
      if (order) {
        await tx.productionOrder.update({
          where: { id: order.id },
          data: {
            actualMaterialCost: roundCost(
              order.actualMaterialCost.plus(issued.totalCost)
            ),
          },
        });
      }
    }

    results.push({
      productId: line.productId,
      quantity: issued.totalQuantity,
      totalCost: issued.totalCost,
      consumptionType,
      allocations: issued.allocations.map(allocation => ({
        lotId: allocation.lotId,
        lotNumber: allocation.lotNumber,
        quantity: allocation.quantity,
        unitCost: allocation.unitCost,
      })),
    });
  }

  return results;
}

/**
 * Consumption and wastage over a period, per material.
 *
 * Wastage percent is scrap over everything issued, both taken from posted
 * ledger rows — there is no estimate anywhere in this figure.
 */
export async function getConsumptionReport(options: {
  from: Date;
  to: Date;
  warehouseId?: number | null;
  itemTypes?: ItemType[];
  productIds?: number[];
}) {
  const movements = await prisma.stockMovement.findMany({
    where: {
      occurredAt: { gte: options.from, lte: options.to },
      movementType: {
        in: [
          StockMovementType.PRODUCTION_CONSUMPTION,
          StockMovementType.SCRAP,
          StockMovementType.EXPIRY_WRITE_OFF,
        ],
      },
      ...(options.warehouseId ? { fromWarehouseId: options.warehouseId } : {}),
      ...(options.productIds && options.productIds.length > 0
        ? { productId: { in: options.productIds } }
        : {}),
      product: {
        itemType: {
          in:
            options.itemTypes && options.itemTypes.length > 0
              ? options.itemTypes
              : MATERIAL_ITEM_TYPES,
        },
      },
    },
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          itemType: true,
          uom: { select: { code: true } },
        },
      },
    },
  });

  const grouped = new Map<
    number,
    {
      productId: number;
      productCode: string;
      productName: string;
      itemType: string;
      uomCode: string | null;
      consumedQuantity: Prisma.Decimal;
      consumedValue: Prisma.Decimal;
      wastedQuantity: Prisma.Decimal;
      wastedValue: Prisma.Decimal;
      expiredQuantity: Prisma.Decimal;
      expiredValue: Prisma.Decimal;
    }
  >();

  for (const movement of movements) {
    const entry = grouped.get(movement.productId) ?? {
      productId: movement.productId,
      productCode: movement.product.code,
      productName: movement.product.name,
      itemType: movement.product.itemType,
      uomCode: movement.product.uom?.code ?? null,
      consumedQuantity: ZERO,
      consumedValue: ZERO,
      wastedQuantity: ZERO,
      wastedValue: ZERO,
      expiredQuantity: ZERO,
      expiredValue: ZERO,
    };

    if (movement.movementType === StockMovementType.PRODUCTION_CONSUMPTION) {
      entry.consumedQuantity = entry.consumedQuantity.plus(movement.quantity);
      entry.consumedValue = entry.consumedValue.plus(movement.totalCost);
    } else if (movement.movementType === StockMovementType.SCRAP) {
      entry.wastedQuantity = entry.wastedQuantity.plus(movement.quantity);
      entry.wastedValue = entry.wastedValue.plus(movement.totalCost);
    } else {
      entry.expiredQuantity = entry.expiredQuantity.plus(movement.quantity);
      entry.expiredValue = entry.expiredValue.plus(movement.totalCost);
    }

    grouped.set(movement.productId, entry);
  }

  const rows = [...grouped.values()].map(entry => {
    const totalIssued = entry.consumedQuantity
      .plus(entry.wastedQuantity)
      .plus(entry.expiredQuantity);
    const totalValue = entry.consumedValue
      .plus(entry.wastedValue)
      .plus(entry.expiredValue);
    const lostQuantity = entry.wastedQuantity.plus(entry.expiredQuantity);
    return {
      ...entry,
      totalIssuedQuantity: roundQuantity(totalIssued),
      totalValue: roundCost(totalValue),
      wastagePercent: percentageOf(lostQuantity, totalIssued),
      wastageValue: roundCost(entry.wastedValue.plus(entry.expiredValue)),
    };
  });

  rows.sort((a, b) => b.totalValue.comparedTo(a.totalValue));

  const totals = rows.reduce(
    (acc, row) => ({
      consumedValue: acc.consumedValue.plus(row.consumedValue),
      wastedValue: acc.wastedValue.plus(row.wastedValue),
      expiredValue: acc.expiredValue.plus(row.expiredValue),
      totalValue: acc.totalValue.plus(row.totalValue),
    }),
    {
      consumedValue: ZERO,
      wastedValue: ZERO,
      expiredValue: ZERO,
      totalValue: ZERO,
    }
  );

  return {
    from: options.from,
    to: options.to,
    rows,
    totals: {
      ...totals,
      wastagePercent: percentageOf(
        totals.wastedValue.plus(totals.expiredValue),
        totals.totalValue
      ),
    },
  };
}

/**
 * Compare what a production order actually consumed against what its BOM said
 * it should. A positive variance means more material went in than planned.
 */
export async function getProductionVariance(productionOrderId: number) {
  const order = await prisma.productionOrder.findUnique({
    where: { id: productionOrderId },
    include: {
      product: { select: { id: true, code: true, name: true } },
      bom: {
        select: { id: true, bomNumber: true, version: true, revision: true },
      },
      components: {
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              uom: { select: { code: true } },
            },
          },
        },
      },
    },
  });
  if (!order) throw new NotFoundError("Production order");

  const lines = order.components.map(component => {
    const actual = component.consumedQuantity.plus(component.wastedQuantity);
    const variance = roundQuantity(actual.minus(component.requiredQuantity));
    return {
      productId: component.productId,
      productCode: component.product.code,
      productName: component.product.name,
      uomCode: component.product.uom?.code ?? null,
      requiredQuantity: component.requiredQuantity,
      issuedQuantity: component.issuedQuantity,
      consumedQuantity: component.consumedQuantity,
      wastedQuantity: component.wastedQuantity,
      varianceQuantity: variance,
      variancePercent: percentageOf(variance, component.requiredQuantity),
      standardUnitCost: component.standardUnitCost,
      varianceValue: roundCost(variance.times(component.standardUnitCost)),
    };
  });

  return {
    productionOrderId: order.id,
    orderNumber: order.orderNumber,
    product: order.product,
    bom: order.bom,
    plannedQuantity: order.plannedQuantity,
    producedQuantity: order.producedQuantity,
    scrappedQuantity: order.scrappedQuantity,
    plannedMaterialCost: order.plannedMaterialCost,
    actualMaterialCost: order.actualMaterialCost,
    costVariance: roundCost(
      order.actualMaterialCost.minus(order.plannedMaterialCost)
    ),
    lines,
  };
}
