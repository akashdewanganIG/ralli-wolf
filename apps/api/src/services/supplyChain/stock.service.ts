import { prisma } from "@repo/db";
import {
  Prisma,
  MovementDirection,
  PickingStrategy,
  ReservationReferenceType,
  ReservationStatus,
  StockMovementType,
  StockStatus,
  LotStatus,
} from "@prisma/client";
import { nextDocumentNumber, SEQUENCE_KEYS } from "./numbering.service.js";
import {
  DomainError,
  InsufficientStockError,
  NotFoundError,
} from "./errors.js";
import {
  ZERO,
  requireNonNegative,
  requirePositive,
  roundCost,
  roundQuantity,
  sum,
  toDecimal,
} from "./decimal.js";

type Tx = Prisma.TransactionClient;

/** Movement types that add stock. */
const INBOUND_TYPES: StockMovementType[] = [
  "OPENING_BALANCE",
  "PURCHASE_RECEIPT",
  "SALES_RETURN",
  "PRODUCTION_RECEIPT",
  "ADJUSTMENT_IN",
  "CYCLE_COUNT_GAIN",
  "TRANSFER_IN",
];

/** Movement types that remove stock. */
const OUTBOUND_TYPES: StockMovementType[] = [
  "PURCHASE_RETURN",
  "SALES_ISSUE",
  "PRODUCTION_CONSUMPTION",
  "SCRAP",
  "ADJUSTMENT_OUT",
  "CYCLE_COUNT_LOSS",
  "EXPIRY_WRITE_OFF",
  "TRANSFER_OUT",
];

export function directionFor(
  movementType: StockMovementType
): MovementDirection {
  if (INBOUND_TYPES.includes(movementType)) return MovementDirection.IN;
  if (OUTBOUND_TYPES.includes(movementType)) return MovementDirection.OUT;
  return MovementDirection.INTERNAL;
}

/**
 * Serialise all stock mutations for one (product, warehouse) pair.
 *
 * Read-modify-write on `stock_balances` is not safe under concurrency on its
 * own: two transactions can both read 10 on hand and both issue 8. A
 * transaction-scoped advisory lock makes the second wait for the first to
 * commit, and it is released automatically on commit or rollback.
 *
 * Callers that touch several products in one transaction must acquire locks
 * in ascending product order — `sortLockOrder` does that — so two concurrent
 * multi-line documents can never deadlock against each other.
 */
async function lockStock(
  tx: Tx,
  productId: number,
  warehouseId: number
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${productId}::int, ${warehouseId}::int)`;
}

/** Deterministic lock order for multi-line documents. */
export function sortLockOrder<T extends { productId: number }>(
  lines: T[]
): T[] {
  return [...lines].sort((a, b) => a.productId - b.productId);
}

export interface LotIdentity {
  lotId?: number | null;
  batchNumber?: string | null;
  serialNumber?: string | null;
  manufacturedDate?: Date | null;
  expiryDate?: Date | null;
  supplierId?: number | null;
}

export interface DocumentReference {
  type: string;
  id?: number | null;
  number?: string | null;
}

export interface ReceiveStockInput {
  productId: number;
  warehouseId: number;
  binId?: number | null;
  palletId?: number | null;
  quantity: Prisma.Decimal | number | string;
  unitCost: Prisma.Decimal | number | string;
  movementType: StockMovementType;
  lot?: LotIdentity;
  status?: StockStatus;
  reference?: DocumentReference;
  reasonCode?: string | null;
  notes?: string | null;
  uomId?: number | null;
  performedById?: number | null;
  occurredAt?: Date;
}

export interface ReceiveStockResult {
  lotId: number;
  lotNumber: string;
  binId: number;
  balanceId: number;
  movementId: number;
  movementNumber: string;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  totalCost: Prisma.Decimal;
}

/**
 * Resolve the bin a receipt should land in. An explicit bin always wins; a
 * warehouse's designated receiving bin is next; otherwise the first active
 * bin in traversal order. A warehouse with no bins cannot hold stock, and
 * saying so loudly is better than inventing a location.
 */
async function resolveInboundBin(
  tx: Tx,
  warehouseId: number,
  binId?: number | null
): Promise<number> {
  if (binId) {
    const bin = await tx.storageBin.findUnique({ where: { id: binId } });
    if (!bin) throw new NotFoundError("Storage bin");
    if (bin.warehouseId !== warehouseId) {
      throw new DomainError(
        "The selected bin belongs to a different warehouse",
        { code: "BIN_WAREHOUSE_MISMATCH" }
      );
    }
    if (bin.isBlocked || !bin.isActive) {
      throw new DomainError(
        `Bin ${bin.code} is blocked or inactive and cannot receive stock`,
        { code: "BIN_BLOCKED" }
      );
    }
    return bin.id;
  }

  const receiving = await tx.storageBin.findFirst({
    where: { warehouseId, isActive: true, isBlocked: false, isReceiving: true },
    orderBy: { pickSequence: "asc" },
  });
  if (receiving) return receiving.id;

  const anyBin = await tx.storageBin.findFirst({
    where: { warehouseId, isActive: true, isBlocked: false },
    orderBy: { pickSequence: "asc" },
  });
  if (anyBin) return anyBin.id;

  throw new DomainError(
    "This warehouse has no active storage bin. Create a zone and at least one bin before receiving stock.",
    { code: "NO_STORAGE_BIN" }
  );
}

/**
 * Find, or create, the balance row for one physical slot. The unique index
 * `stock_balances_slot_key` guarantees at most one row per slot; the advisory
 * lock held by the caller guarantees we do not race to create it.
 */
async function upsertBalance(
  tx: Tx,
  slot: {
    productId: number;
    warehouseId: number;
    binId: number;
    lotId: number;
    palletId?: number | null;
    status: StockStatus;
  },
  delta: Prisma.Decimal,
  occurredAt: Date
) {
  const existing = await tx.stockBalance.findFirst({
    where: {
      productId: slot.productId,
      warehouseId: slot.warehouseId,
      binId: slot.binId,
      lotId: slot.lotId,
      palletId: slot.palletId ?? null,
    },
  });

  if (!existing) {
    if (delta.isNegative()) {
      throw new DomainError("Cannot remove stock from a slot that holds none", {
        code: "NO_STOCK_IN_SLOT",
      });
    }
    return tx.stockBalance.create({
      data: {
        productId: slot.productId,
        warehouseId: slot.warehouseId,
        binId: slot.binId,
        lotId: slot.lotId,
        palletId: slot.palletId ?? null,
        quantity: roundQuantity(delta),
        status: slot.status,
        lastMovementAt: occurredAt,
      },
    });
  }

  const newQuantity = roundQuantity(existing.quantity.plus(delta));
  return tx.stockBalance.update({
    where: { id: existing.id },
    data: { quantity: newQuantity, lastMovementAt: occurredAt },
  });
}

/**
 * Derive an expiry date when the receipt does not carry one but the item has
 * a defined shelf life. Nothing is invented: if neither a manufactured date
 * nor a shelf life is on record the lot simply has no expiry, and FEFO will
 * sort it last.
 */
function deriveExpiry(
  provided: Date | null | undefined,
  manufacturedDate: Date | null | undefined,
  shelfLifeDays: number | null
): Date | null {
  if (provided) return provided;
  if (manufacturedDate && shelfLifeDays && shelfLifeDays > 0) {
    const expiry = new Date(manufacturedDate);
    expiry.setUTCDate(expiry.getUTCDate() + shelfLifeDays);
    return expiry;
  }
  return null;
}

/**
 * Post an inbound movement: purchase receipt, production output, customer
 * return, positive adjustment or opening balance.
 */
export async function receiveStock(
  tx: Tx,
  input: ReceiveStockInput
): Promise<ReceiveStockResult> {
  const quantity = requirePositive(input.quantity, "quantity");
  const unitCost = requireNonNegative(input.unitCost, "unitCost");
  const occurredAt = input.occurredAt ?? new Date();

  const product = await tx.product.findUnique({
    where: { id: input.productId },
  });
  if (!product) throw new NotFoundError("Product");
  if (!product.isStockTracked) {
    throw new DomainError(
      `${product.code} is not stock tracked and cannot hold inventory`,
      { code: "NOT_STOCK_TRACKED" }
    );
  }

  const warehouse = await tx.warehouse.findUnique({
    where: { id: input.warehouseId },
  });
  if (!warehouse) throw new NotFoundError("Warehouse");
  if (!warehouse.isActive) {
    throw new DomainError(`Warehouse ${warehouse.code} is inactive`, {
      code: "WAREHOUSE_INACTIVE",
    });
  }

  await lockStock(tx, input.productId, input.warehouseId);

  const binId = await resolveInboundBin(tx, input.warehouseId, input.binId);
  const identity = input.lot ?? {};

  // Enforce the item's tracking policy up front — a serialised tool that
  // arrives without a serial number is a data-quality problem, not something
  // to paper over with a generated placeholder.
  if (
    product.trackingType === "BATCH" &&
    !identity.lotId &&
    !identity.batchNumber
  ) {
    throw new DomainError(
      `${product.code} is batch tracked; a batch number is required`,
      { code: "BATCH_NUMBER_REQUIRED" }
    );
  }
  if (product.trackingType === "SERIAL" && !identity.lotId) {
    if (!identity.serialNumber) {
      throw new DomainError(
        `${product.code} is serial tracked; a serial number is required`,
        { code: "SERIAL_NUMBER_REQUIRED" }
      );
    }
    if (!quantity.equals(1)) {
      throw new DomainError(
        `${product.code} is serial tracked; receive one unit per serial number`,
        { code: "SERIAL_QUANTITY_INVALID" }
      );
    }
  }

  let lot: { id: number; lotNumber: string };

  if (identity.lotId) {
    const existingLot = await tx.stockLot.findUnique({
      where: { id: identity.lotId },
    });
    if (!existingLot) throw new NotFoundError("Stock lot");
    if (existingLot.productId !== input.productId) {
      throw new DomainError("The selected lot belongs to a different product", {
        code: "LOT_PRODUCT_MISMATCH",
      });
    }
    const updated = await tx.stockLot.update({
      where: { id: existingLot.id },
      data: {
        remainingQuantity: roundQuantity(
          existingLot.remainingQuantity.plus(quantity)
        ),
        originalQuantity: roundQuantity(
          existingLot.originalQuantity.plus(quantity)
        ),
        status: LotStatus.ACTIVE,
      },
    });
    lot = { id: updated.id, lotNumber: updated.lotNumber };
  } else {
    if (identity.serialNumber) {
      const duplicate = await tx.stockLot.findFirst({
        where: {
          productId: input.productId,
          serialNumber: identity.serialNumber,
        },
      });
      if (duplicate) {
        throw new DomainError(
          `Serial number ${identity.serialNumber} already exists for ${product.code} (lot ${duplicate.lotNumber})`,
          { status: 409, code: "DUPLICATE_SERIAL" }
        );
      }
    }

    const lotNumber = await nextDocumentNumber(
      tx,
      SEQUENCE_KEYS.STOCK_LOT,
      occurredAt
    );
    const created = await tx.stockLot.create({
      data: {
        lotNumber,
        productId: input.productId,
        originWarehouseId: input.warehouseId,
        batchNumber: identity.batchNumber ?? null,
        serialNumber: identity.serialNumber ?? null,
        manufacturedDate: identity.manufacturedDate ?? null,
        expiryDate: deriveExpiry(
          identity.expiryDate,
          identity.manufacturedDate,
          product.shelfLifeDays
        ),
        receivedAt: occurredAt,
        originalQuantity: roundQuantity(quantity),
        remainingQuantity: roundQuantity(quantity),
        unitCost: roundCost(unitCost),
        supplierId: identity.supplierId ?? null,
        sourceType: input.movementType,
        sourceReference: input.reference?.number ?? null,
      },
    });
    lot = { id: created.id, lotNumber: created.lotNumber };
  }

  const balance = await upsertBalance(
    tx,
    {
      productId: input.productId,
      warehouseId: input.warehouseId,
      binId,
      lotId: lot.id,
      palletId: input.palletId ?? null,
      status: input.status ?? StockStatus.AVAILABLE,
    },
    quantity,
    occurredAt
  );

  const totalCost = roundCost(quantity.times(unitCost));
  const movementNumber = await nextDocumentNumber(
    tx,
    SEQUENCE_KEYS.STOCK_MOVEMENT,
    occurredAt
  );
  const movement = await tx.stockMovement.create({
    data: {
      movementNumber,
      movementType: input.movementType,
      direction: directionFor(input.movementType),
      productId: input.productId,
      lotId: lot.id,
      uomId: input.uomId ?? product.uomId,
      quantity: roundQuantity(quantity),
      unitCost: roundCost(unitCost),
      totalCost,
      toWarehouseId: input.warehouseId,
      toBinId: binId,
      referenceType: input.reference?.type ?? null,
      referenceId: input.reference?.id ?? null,
      referenceNumber: input.reference?.number ?? null,
      reasonCode: input.reasonCode ?? null,
      notes: input.notes ?? null,
      performedById: input.performedById ?? null,
      occurredAt,
    },
  });

  return {
    lotId: lot.id,
    lotNumber: lot.lotNumber,
    binId,
    balanceId: balance.id,
    movementId: movement.id,
    movementNumber: movement.movementNumber,
    quantity: roundQuantity(quantity),
    unitCost: roundCost(unitCost),
    totalCost,
  };
}

export interface AllocationCandidate {
  balanceId: number;
  binId: number;
  binCode: string;
  lotId: number;
  lotNumber: string;
  batchNumber: string | null;
  serialNumber: string | null;
  expiryDate: Date | null;
  receivedAt: Date;
  unitCost: Prisma.Decimal;
  availableQuantity: Prisma.Decimal;
}

export interface Allocation {
  balanceId: number;
  binId: number;
  binCode: string;
  lotId: number;
  lotNumber: string;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  expiryDate: Date | null;
}

/**
 * Order the candidate slots by the item's picking strategy.
 *
 * FIFO/LIFO order by the date the layer was received; FEFO orders by expiry
 * so short-dated stock leaves first, with never-expiring layers last. Ties
 * break on lot id so the sequence is stable and reproducible.
 */
export function sortCandidates(
  candidates: AllocationCandidate[],
  strategy: PickingStrategy
): AllocationCandidate[] {
  const sorted = [...candidates];
  if (strategy === PickingStrategy.LIFO) {
    sorted.sort(
      (a, b) =>
        b.receivedAt.getTime() - a.receivedAt.getTime() || b.lotId - a.lotId
    );
    return sorted;
  }
  if (strategy === PickingStrategy.FEFO) {
    sorted.sort((a, b) => {
      const aExpiry = a.expiryDate
        ? a.expiryDate.getTime()
        : Number.POSITIVE_INFINITY;
      const bExpiry = b.expiryDate
        ? b.expiryDate.getTime()
        : Number.POSITIVE_INFINITY;
      if (aExpiry !== bExpiry) return aExpiry - bExpiry;
      return (
        a.receivedAt.getTime() - b.receivedAt.getTime() || a.lotId - b.lotId
      );
    });
    return sorted;
  }
  sorted.sort(
    (a, b) =>
      a.receivedAt.getTime() - b.receivedAt.getTime() || a.lotId - b.lotId
  );
  return sorted;
}

interface CandidateQuery {
  productId: number;
  warehouseId: number;
  binId?: number | null;
  lotId?: number | null;
  status?: StockStatus;
  /** Draw from reserved quantity instead of free quantity (picking a reservation). */
  includeReserved?: boolean;
}

async function loadCandidates(
  tx: Tx,
  query: CandidateQuery
): Promise<AllocationCandidate[]> {
  const balances = await tx.stockBalance.findMany({
    where: {
      productId: query.productId,
      warehouseId: query.warehouseId,
      status: query.status ?? StockStatus.AVAILABLE,
      ...(query.binId ? { binId: query.binId } : {}),
      ...(query.lotId ? { lotId: query.lotId } : {}),
      quantity: { gt: 0 },
    },
    include: {
      lot: true,
      bin: { select: { id: true, code: true } },
    },
  });

  return balances
    .map(balance => {
      const available = query.includeReserved
        ? balance.quantity
        : balance.quantity.minus(balance.reservedQuantity);
      return {
        balanceId: balance.id,
        binId: balance.binId,
        binCode: balance.bin.code,
        lotId: balance.lotId,
        lotNumber: balance.lot.lotNumber,
        batchNumber: balance.lot.batchNumber,
        serialNumber: balance.lot.serialNumber,
        expiryDate: balance.lot.expiryDate,
        receivedAt: balance.lot.receivedAt,
        unitCost: balance.lot.unitCost,
        availableQuantity: available,
      };
    })
    .filter(candidate => candidate.availableQuantity.greaterThan(0));
}

export interface IssueStockInput {
  productId: number;
  warehouseId: number;
  quantity: Prisma.Decimal | number | string;
  movementType: StockMovementType;
  binId?: number | null;
  lotId?: number | null;
  strategy?: PickingStrategy;
  reference?: DocumentReference;
  reasonCode?: string | null;
  notes?: string | null;
  uomId?: number | null;
  performedById?: number | null;
  occurredAt?: Date;
  /** Consume against an existing reservation rather than free stock. */
  consumeReservedQuantity?: boolean;
}

export interface IssueStockResult {
  allocations: Allocation[];
  totalQuantity: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  movementIds: number[];
}

/**
 * Post an outbound movement, consuming cost layers in the item's configured
 * order. One ledger row is written per layer touched, so the cost of goods
 * issued is exact rather than an average applied after the fact.
 */
export async function issueStock(
  tx: Tx,
  input: IssueStockInput
): Promise<IssueStockResult> {
  const quantity = requirePositive(input.quantity, "quantity");
  const occurredAt = input.occurredAt ?? new Date();

  const product = await tx.product.findUnique({
    where: { id: input.productId },
  });
  if (!product) throw new NotFoundError("Product");

  const warehouse = await tx.warehouse.findUnique({
    where: { id: input.warehouseId },
  });
  if (!warehouse) throw new NotFoundError("Warehouse");

  await lockStock(tx, input.productId, input.warehouseId);

  const strategy = input.strategy ?? product.pickingStrategy;
  const candidates = sortCandidates(
    await loadCandidates(tx, {
      productId: input.productId,
      warehouseId: input.warehouseId,
      binId: input.binId,
      lotId: input.lotId,
      includeReserved: input.consumeReservedQuantity,
    }),
    strategy
  );

  const totalAvailable = sum(
    candidates.map(candidate => candidate.availableQuantity)
  );
  if (totalAvailable.lessThan(quantity) && !warehouse.allowNegativeStock) {
    throw new InsufficientStockError(
      `Insufficient stock for ${product.code} in ${warehouse.code}: ${quantity.toFixed(4)} requested, ${totalAvailable.toFixed(4)} available`,
      {
        productId: product.id,
        productCode: product.code,
        warehouseId: warehouse.id,
        requested: quantity.toFixed(4),
        available: totalAvailable.toFixed(4),
        shortfall: quantity.minus(totalAvailable).toFixed(4),
      }
    );
  }

  const allocations: Allocation[] = [];
  const movementIds: number[] = [];
  let remaining = quantity;

  for (const candidate of candidates) {
    if (remaining.lessThanOrEqualTo(0)) break;
    const take = roundQuantity(
      Prisma.Decimal.min(remaining, candidate.availableQuantity)
    );
    if (take.lessThanOrEqualTo(0)) continue;

    const balance = await tx.stockBalance.findUnique({
      where: { id: candidate.balanceId },
    });
    if (!balance) continue;

    await tx.stockBalance.update({
      where: { id: candidate.balanceId },
      data: {
        quantity: roundQuantity(balance.quantity.minus(take)),
        ...(input.consumeReservedQuantity
          ? {
              reservedQuantity: roundQuantity(
                Prisma.Decimal.max(ZERO, balance.reservedQuantity.minus(take))
              ),
            }
          : {}),
        lastMovementAt: occurredAt,
      },
    });

    const lot = await tx.stockLot.findUnique({
      where: { id: candidate.lotId },
    });
    if (lot) {
      const lotRemaining = roundQuantity(
        Prisma.Decimal.max(ZERO, lot.remainingQuantity.minus(take))
      );
      await tx.stockLot.update({
        where: { id: lot.id },
        data: {
          remainingQuantity: lotRemaining,
          status: lotRemaining.isZero() ? LotStatus.CONSUMED : lot.status,
        },
      });
    }

    const lineCost = roundCost(take.times(candidate.unitCost));
    const movementNumber = await nextDocumentNumber(
      tx,
      SEQUENCE_KEYS.STOCK_MOVEMENT,
      occurredAt
    );
    const movement = await tx.stockMovement.create({
      data: {
        movementNumber,
        movementType: input.movementType,
        direction: directionFor(input.movementType),
        productId: input.productId,
        lotId: candidate.lotId,
        uomId: input.uomId ?? product.uomId,
        quantity: take,
        unitCost: candidate.unitCost,
        totalCost: lineCost,
        fromWarehouseId: input.warehouseId,
        fromBinId: candidate.binId,
        referenceType: input.reference?.type ?? null,
        referenceId: input.reference?.id ?? null,
        referenceNumber: input.reference?.number ?? null,
        reasonCode: input.reasonCode ?? null,
        notes: input.notes ?? null,
        performedById: input.performedById ?? null,
        occurredAt,
      },
    });

    movementIds.push(movement.id);
    allocations.push({
      balanceId: candidate.balanceId,
      binId: candidate.binId,
      binCode: candidate.binCode,
      lotId: candidate.lotId,
      lotNumber: candidate.lotNumber,
      quantity: take,
      unitCost: candidate.unitCost,
      totalCost: lineCost,
      expiryDate: candidate.expiryDate,
    });

    remaining = roundQuantity(remaining.minus(take));
  }

  if (remaining.greaterThan(0)) {
    // Only reachable when the warehouse explicitly permits negative stock.
    // The shortfall is still posted so the ledger and the balance agree; the
    // balance simply goes negative and the resulting alert makes it visible.
    const binId = await resolveInboundBin(tx, input.warehouseId, input.binId);
    const fallbackCost = product.standardCost ?? ZERO;
    const lotNumber = await nextDocumentNumber(
      tx,
      SEQUENCE_KEYS.STOCK_LOT,
      occurredAt
    );
    const negativeLot = await tx.stockLot.create({
      data: {
        lotNumber,
        productId: input.productId,
        originWarehouseId: input.warehouseId,
        receivedAt: occurredAt,
        originalQuantity: ZERO,
        remainingQuantity: ZERO,
        unitCost: roundCost(fallbackCost),
        sourceType: `NEGATIVE_${input.movementType}`,
        sourceReference: input.reference?.number ?? null,
      },
    });

    const existing = await tx.stockBalance.findFirst({
      where: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        binId,
        lotId: negativeLot.id,
        palletId: null,
      },
    });
    if (existing) {
      await tx.stockBalance.update({
        where: { id: existing.id },
        data: {
          quantity: roundQuantity(existing.quantity.minus(remaining)),
          lastMovementAt: occurredAt,
        },
      });
    } else {
      await tx.stockBalance.create({
        data: {
          productId: input.productId,
          warehouseId: input.warehouseId,
          binId,
          lotId: negativeLot.id,
          quantity: roundQuantity(remaining.negated()),
          lastMovementAt: occurredAt,
        },
      });
    }

    const lineCost = roundCost(remaining.times(fallbackCost));
    const movementNumber = await nextDocumentNumber(
      tx,
      SEQUENCE_KEYS.STOCK_MOVEMENT,
      occurredAt
    );
    const movement = await tx.stockMovement.create({
      data: {
        movementNumber,
        movementType: input.movementType,
        direction: directionFor(input.movementType),
        productId: input.productId,
        lotId: negativeLot.id,
        uomId: input.uomId ?? product.uomId,
        quantity: remaining,
        unitCost: roundCost(fallbackCost),
        totalCost: lineCost,
        fromWarehouseId: input.warehouseId,
        fromBinId: binId,
        referenceType: input.reference?.type ?? null,
        referenceId: input.reference?.id ?? null,
        referenceNumber: input.reference?.number ?? null,
        reasonCode: input.reasonCode ?? "NEGATIVE_STOCK",
        notes: "Issued against negative stock; warehouse permits overdraw",
        performedById: input.performedById ?? null,
        occurredAt,
      },
    });

    movementIds.push(movement.id);
    allocations.push({
      balanceId: 0,
      binId,
      binCode: "",
      lotId: negativeLot.id,
      lotNumber: negativeLot.lotNumber,
      quantity: remaining,
      unitCost: roundCost(fallbackCost),
      totalCost: lineCost,
      expiryDate: null,
    });
  }

  return {
    allocations,
    totalQuantity: sum(allocations.map(allocation => allocation.quantity)),
    totalCost: sum(allocations.map(allocation => allocation.totalCost)),
    movementIds,
  };
}

export interface MoveStockInput {
  productId: number;
  lotId: number;
  quantity: Prisma.Decimal | number | string;
  fromWarehouseId: number;
  fromBinId: number;
  toWarehouseId: number;
  toBinId: number;
  toPalletId?: number | null;
  reference?: DocumentReference;
  reasonCode?: string | null;
  notes?: string | null;
  performedById?: number | null;
  occurredAt?: Date;
}

/**
 * Move stock between locations without changing how much of it exists.
 *
 * A bin-to-bin move inside one warehouse writes a single INTERNAL row; a move
 * between warehouses writes a TRANSFER_OUT / TRANSFER_IN pair so per-warehouse
 * ledgers stay balanced. In both cases the cost layer travels with the goods,
 * which is what keeps FIFO/FEFO honest across a transfer.
 */
export async function moveStock(tx: Tx, input: MoveStockInput) {
  const quantity = requirePositive(input.quantity, "quantity");
  const occurredAt = input.occurredAt ?? new Date();
  const crossWarehouse = input.fromWarehouseId !== input.toWarehouseId;

  const product = await tx.product.findUnique({
    where: { id: input.productId },
  });
  if (!product) throw new NotFoundError("Product");

  const lot = await tx.stockLot.findUnique({ where: { id: input.lotId } });
  if (!lot) throw new NotFoundError("Stock lot");
  if (lot.productId !== input.productId) {
    throw new DomainError("The selected lot belongs to a different product", {
      code: "LOT_PRODUCT_MISMATCH",
    });
  }

  // Lock both sides in ascending warehouse order to avoid deadlocking against
  // a transfer running the opposite way.
  const lockOrder = [input.fromWarehouseId, input.toWarehouseId].sort(
    (a, b) => a - b
  );
  for (const warehouseId of lockOrder) {
    await lockStock(tx, input.productId, warehouseId);
  }

  const source = await tx.stockBalance.findFirst({
    where: {
      productId: input.productId,
      warehouseId: input.fromWarehouseId,
      binId: input.fromBinId,
      lotId: input.lotId,
    },
    include: { bin: { select: { code: true } } },
  });
  if (!source)
    throw new DomainError("No stock of that lot in the source bin", {
      code: "NO_STOCK_IN_SLOT",
    });

  const movable = source.quantity.minus(source.reservedQuantity);
  if (movable.lessThan(quantity)) {
    throw new InsufficientStockError(
      `Only ${movable.toFixed(4)} of lot ${lot.lotNumber} is free to move from bin ${source.bin.code}`,
      {
        productId: product.id,
        productCode: product.code,
        warehouseId: input.fromWarehouseId,
        requested: quantity.toFixed(4),
        available: movable.toFixed(4),
        shortfall: quantity.minus(movable).toFixed(4),
      }
    );
  }

  const destinationBin = await tx.storageBin.findUnique({
    where: { id: input.toBinId },
  });
  if (!destinationBin) throw new NotFoundError("Destination bin");
  if (destinationBin.warehouseId !== input.toWarehouseId) {
    throw new DomainError(
      "The destination bin belongs to a different warehouse",
      { code: "BIN_WAREHOUSE_MISMATCH" }
    );
  }
  if (destinationBin.isBlocked || !destinationBin.isActive) {
    throw new DomainError(`Bin ${destinationBin.code} is blocked or inactive`, {
      code: "BIN_BLOCKED",
    });
  }

  await tx.stockBalance.update({
    where: { id: source.id },
    data: {
      quantity: roundQuantity(source.quantity.minus(quantity)),
      lastMovementAt: occurredAt,
    },
  });

  await upsertBalance(
    tx,
    {
      productId: input.productId,
      warehouseId: input.toWarehouseId,
      binId: input.toBinId,
      lotId: input.lotId,
      palletId: input.toPalletId ?? null,
      status: source.status,
    },
    quantity,
    occurredAt
  );

  const totalCost = roundCost(quantity.times(lot.unitCost));
  const movementIds: number[] = [];

  const baseData = {
    productId: input.productId,
    lotId: input.lotId,
    uomId: product.uomId,
    quantity: roundQuantity(quantity),
    unitCost: lot.unitCost,
    totalCost,
    referenceType: input.reference?.type ?? null,
    referenceId: input.reference?.id ?? null,
    referenceNumber: input.reference?.number ?? null,
    reasonCode: input.reasonCode ?? null,
    notes: input.notes ?? null,
    performedById: input.performedById ?? null,
    occurredAt,
  };

  if (crossWarehouse) {
    const outNumber = await nextDocumentNumber(
      tx,
      SEQUENCE_KEYS.STOCK_MOVEMENT,
      occurredAt
    );
    const out = await tx.stockMovement.create({
      data: {
        ...baseData,
        movementNumber: outNumber,
        movementType: StockMovementType.TRANSFER_OUT,
        direction: MovementDirection.OUT,
        fromWarehouseId: input.fromWarehouseId,
        fromBinId: input.fromBinId,
      },
    });
    const inNumber = await nextDocumentNumber(
      tx,
      SEQUENCE_KEYS.STOCK_MOVEMENT,
      occurredAt
    );
    const inbound = await tx.stockMovement.create({
      data: {
        ...baseData,
        movementNumber: inNumber,
        movementType: StockMovementType.TRANSFER_IN,
        direction: MovementDirection.IN,
        toWarehouseId: input.toWarehouseId,
        toBinId: input.toBinId,
      },
    });
    movementIds.push(out.id, inbound.id);
  } else {
    const movementNumber = await nextDocumentNumber(
      tx,
      SEQUENCE_KEYS.STOCK_MOVEMENT,
      occurredAt
    );
    const movement = await tx.stockMovement.create({
      data: {
        ...baseData,
        movementNumber,
        movementType: StockMovementType.INTERNAL_MOVE,
        direction: MovementDirection.INTERNAL,
        fromWarehouseId: input.fromWarehouseId,
        fromBinId: input.fromBinId,
        toWarehouseId: input.toWarehouseId,
        toBinId: input.toBinId,
      },
    });
    movementIds.push(movement.id);
  }

  return { movementIds, quantity: roundQuantity(quantity), totalCost };
}

export interface ReserveStockInput {
  productId: number;
  warehouseId: number;
  quantity: Prisma.Decimal | number | string;
  referenceType: ReservationReferenceType;
  referenceId: number;
  referenceNumber?: string | null;
  strategy?: PickingStrategy;
  expiresAt?: Date | null;
  createdById?: number | null;
}

/**
 * Soft-allocate stock to a demand document. Nothing moves; the reserved
 * quantity on each slot rises so the same units cannot be promised twice.
 */
export async function reserveStock(tx: Tx, input: ReserveStockInput) {
  const quantity = requirePositive(input.quantity, "quantity");

  const product = await tx.product.findUnique({
    where: { id: input.productId },
  });
  if (!product) throw new NotFoundError("Product");
  const warehouse = await tx.warehouse.findUnique({
    where: { id: input.warehouseId },
  });
  if (!warehouse) throw new NotFoundError("Warehouse");

  await lockStock(tx, input.productId, input.warehouseId);

  const candidates = sortCandidates(
    await loadCandidates(tx, {
      productId: input.productId,
      warehouseId: input.warehouseId,
    }),
    input.strategy ?? product.pickingStrategy
  );

  const totalAvailable = sum(
    candidates.map(candidate => candidate.availableQuantity)
  );
  if (totalAvailable.lessThan(quantity)) {
    throw new InsufficientStockError(
      `Cannot reserve ${quantity.toFixed(4)} of ${product.code} in ${warehouse.code}: only ${totalAvailable.toFixed(4)} is unreserved`,
      {
        productId: product.id,
        productCode: product.code,
        warehouseId: warehouse.id,
        requested: quantity.toFixed(4),
        available: totalAvailable.toFixed(4),
        shortfall: quantity.minus(totalAvailable).toFixed(4),
      }
    );
  }

  const reservations = [];
  let remaining = quantity;

  for (const candidate of candidates) {
    if (remaining.lessThanOrEqualTo(0)) break;
    const take = roundQuantity(
      Prisma.Decimal.min(remaining, candidate.availableQuantity)
    );
    if (take.lessThanOrEqualTo(0)) continue;

    const balance = await tx.stockBalance.findUnique({
      where: { id: candidate.balanceId },
    });
    if (!balance) continue;

    await tx.stockBalance.update({
      where: { id: candidate.balanceId },
      data: {
        reservedQuantity: roundQuantity(balance.reservedQuantity.plus(take)),
      },
    });

    const reservation = await tx.stockReservation.create({
      data: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        lotId: candidate.lotId,
        quantity: take,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        referenceNumber: input.referenceNumber ?? null,
        expiresAt: input.expiresAt ?? null,
        createdById: input.createdById ?? null,
      },
    });

    reservations.push(reservation);
    remaining = roundQuantity(remaining.minus(take));
  }

  return reservations;
}

/**
 * Give reserved stock back. Used when a demand document is cancelled, and
 * after picking, where the picked quantity has already left the slot.
 */
export async function releaseReservations(
  tx: Tx,
  filter: {
    referenceType: ReservationReferenceType;
    referenceId: number;
    reservationId?: number;
  }
) {
  const reservations = await tx.stockReservation.findMany({
    where: {
      ...(filter.reservationId ? { id: filter.reservationId } : {}),
      referenceType: filter.referenceType,
      referenceId: filter.referenceId,
      status: {
        in: [ReservationStatus.ACTIVE, ReservationStatus.PARTIALLY_RELEASED],
      },
    },
  });

  for (const reservation of reservations) {
    const outstanding = reservation.quantity.minus(
      reservation.releasedQuantity
    );
    if (outstanding.lessThanOrEqualTo(0)) continue;

    await lockStock(tx, reservation.productId, reservation.warehouseId);

    const balances = await tx.stockBalance.findMany({
      where: {
        productId: reservation.productId,
        warehouseId: reservation.warehouseId,
        ...(reservation.lotId ? { lotId: reservation.lotId } : {}),
        reservedQuantity: { gt: 0 },
      },
    });

    let remaining = outstanding;
    for (const balance of balances) {
      if (remaining.lessThanOrEqualTo(0)) break;
      const give = Prisma.Decimal.min(remaining, balance.reservedQuantity);
      await tx.stockBalance.update({
        where: { id: balance.id },
        data: {
          reservedQuantity: roundQuantity(balance.reservedQuantity.minus(give)),
        },
      });
      remaining = roundQuantity(remaining.minus(give));
    }

    await tx.stockReservation.update({
      where: { id: reservation.id },
      data: {
        releasedQuantity: reservation.quantity,
        status: ReservationStatus.RELEASED,
      },
    });
  }

  return reservations.length;
}

export interface AvailabilityRow {
  productId: number;
  warehouseId: number;
  onHand: Prisma.Decimal;
  reserved: Prisma.Decimal;
  available: Prisma.Decimal;
  value: Prisma.Decimal;
}

/**
 * On-hand, reserved and available quantity plus valuation, computed from the
 * balance rows and their cost layers. There is no cached total to drift.
 */
export async function getAvailability(
  productIds: number[],
  warehouseId?: number | null,
  client: Tx | typeof prisma = prisma
): Promise<Map<string, AvailabilityRow>> {
  if (productIds.length === 0) return new Map();

  const balances = await client.stockBalance.findMany({
    where: {
      productId: { in: productIds },
      ...(warehouseId ? { warehouseId } : {}),
      status: StockStatus.AVAILABLE,
    },
    include: { lot: { select: { unitCost: true } } },
  });

  const result = new Map<string, AvailabilityRow>();
  for (const balance of balances) {
    const key = `${balance.productId}:${warehouseId ? balance.warehouseId : 0}`;
    const current = result.get(key) ?? {
      productId: balance.productId,
      warehouseId: warehouseId ? balance.warehouseId : 0,
      onHand: ZERO,
      reserved: ZERO,
      available: ZERO,
      value: ZERO,
    };
    current.onHand = current.onHand.plus(balance.quantity);
    current.reserved = current.reserved.plus(balance.reservedQuantity);
    current.available = current.onHand.minus(current.reserved);
    current.value = current.value.plus(
      balance.quantity.times(balance.lot.unitCost)
    );
    result.set(key, current);
  }

  for (const productId of productIds) {
    const key = `${productId}:${warehouseId ?? 0}`;
    if (!result.has(key)) {
      result.set(key, {
        productId,
        warehouseId: warehouseId ?? 0,
        onHand: ZERO,
        reserved: ZERO,
        available: ZERO,
        value: ZERO,
      });
    }
  }

  return result;
}

/** Available quantity for a single product/warehouse pair. */
export async function getAvailableQuantity(
  productId: number,
  warehouseId?: number | null,
  client: Tx | typeof prisma = prisma
): Promise<Prisma.Decimal> {
  const map = await getAvailability([productId], warehouseId, client);
  return map.get(`${productId}:${warehouseId ?? 0}`)?.available ?? ZERO;
}

/**
 * Quantity already on order from suppliers and not yet received. Planning
 * needs this so a reorder alert is not raised for something already bought.
 */
export async function getIncomingQuantity(
  productIds: number[],
  warehouseId?: number | null,
  client: Tx | typeof prisma = prisma
): Promise<Map<number, Prisma.Decimal>> {
  if (productIds.length === 0) return new Map();

  const lines = await client.purchaseOrderLine.findMany({
    where: {
      productId: { in: productIds },
      status: { in: ["OPEN", "PARTIALLY_RECEIVED"] },
      purchaseOrder: {
        status: {
          in: ["APPROVED", "SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"],
        },
        ...(warehouseId ? { warehouseId } : {}),
      },
    },
    select: { productId: true, quantity: true, receivedQuantity: true },
  });

  const result = new Map<number, Prisma.Decimal>();
  for (const line of lines) {
    const outstanding = line.quantity.minus(line.receivedQuantity);
    if (outstanding.lessThanOrEqualTo(0)) continue;
    result.set(
      line.productId,
      (result.get(line.productId) ?? ZERO).plus(outstanding)
    );
  }
  return result;
}

/** Outstanding purchase quantity keyed by the physical destination warehouse. */
export async function getIncomingQuantityByWarehouse(
  productIds: number[],
  warehouseIds?: number[],
  client: Tx | typeof prisma = prisma
): Promise<Map<string, Prisma.Decimal>> {
  if (productIds.length === 0) return new Map();

  const lines = await client.purchaseOrderLine.findMany({
    where: {
      productId: { in: productIds },
      status: { in: ["OPEN", "PARTIALLY_RECEIVED"] },
      purchaseOrder: {
        status: {
          in: ["APPROVED", "SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"],
        },
        ...(warehouseIds?.length ? { warehouseId: { in: warehouseIds } } : {}),
      },
    },
    select: {
      productId: true,
      quantity: true,
      receivedQuantity: true,
      purchaseOrder: { select: { warehouseId: true } },
    },
  });

  const result = new Map<string, Prisma.Decimal>();
  for (const line of lines) {
    const outstanding = line.quantity.minus(line.receivedQuantity);
    if (outstanding.lessThanOrEqualTo(0)) continue;
    const key = `${line.productId}:${line.purchaseOrder.warehouseId}`;
    result.set(key, (result.get(key) ?? ZERO).plus(outstanding));
  }
  return result;
}

/** Stock position keyed by product and warehouse, without cross-location aggregation. */
export async function getAvailabilityByWarehouse(
  productIds: number[],
  warehouseIds?: number[],
  client: Tx | typeof prisma = prisma
): Promise<Map<string, AvailabilityRow>> {
  if (productIds.length === 0) return new Map();

  const balances = await client.stockBalance.findMany({
    where: {
      productId: { in: productIds },
      ...(warehouseIds?.length ? { warehouseId: { in: warehouseIds } } : {}),
      status: StockStatus.AVAILABLE,
    },
    include: { lot: { select: { unitCost: true } } },
  });

  const result = new Map<string, AvailabilityRow>();
  for (const balance of balances) {
    const key = `${balance.productId}:${balance.warehouseId}`;
    const current = result.get(key) ?? {
      productId: balance.productId,
      warehouseId: balance.warehouseId,
      onHand: ZERO,
      reserved: ZERO,
      available: ZERO,
      value: ZERO,
    };
    current.onHand = current.onHand.plus(balance.quantity);
    current.reserved = current.reserved.plus(balance.reservedQuantity);
    current.available = current.onHand.minus(current.reserved);
    current.value = current.value.plus(
      balance.quantity.times(balance.lot.unitCost)
    );
    result.set(key, current);
  }
  return result;
}

export interface AdjustStockInput {
  productId: number;
  warehouseId: number;
  binId: number;
  lotId?: number | null;
  /** Signed change: positive writes stock on, negative writes it off. */
  deltaQuantity: Prisma.Decimal | number | string;
  unitCost?: Prisma.Decimal | number | string | null;
  reasonCode: string;
  notes?: string | null;
  performedById?: number | null;
  movementType?: StockMovementType;
}

/**
 * Write stock on or off against a documented reason. A write-on must state
 * the unit cost of what is being added — the alternative would be booking
 * inventory value out of thin air.
 */
export async function adjustStock(tx: Tx, input: AdjustStockInput) {
  const delta = toDecimal(input.deltaQuantity, "deltaQuantity");
  if (delta.isZero()) {
    throw new DomainError("deltaQuantity must not be zero", {
      code: "VALIDATION_ERROR",
    });
  }
  if (!input.reasonCode || !input.reasonCode.trim()) {
    throw new DomainError("A reason code is required for a stock adjustment", {
      code: "REASON_REQUIRED",
    });
  }

  if (delta.isPositive()) {
    let unitCost = input.unitCost
      ? toDecimal(input.unitCost, "unitCost")
      : null;
    if (input.lotId && unitCost === null) {
      const lot = await tx.stockLot.findUnique({ where: { id: input.lotId } });
      if (!lot) throw new NotFoundError("Stock lot");
      unitCost = lot.unitCost;
    }
    if (unitCost === null) {
      throw new DomainError(
        "A unit cost is required when writing stock on without an existing lot",
        {
          code: "UNIT_COST_REQUIRED",
        }
      );
    }
    return receiveStock(tx, {
      productId: input.productId,
      warehouseId: input.warehouseId,
      binId: input.binId,
      quantity: delta,
      unitCost,
      movementType: input.movementType ?? StockMovementType.ADJUSTMENT_IN,
      lot: input.lotId ? { lotId: input.lotId } : undefined,
      reasonCode: input.reasonCode,
      notes: input.notes ?? null,
      performedById: input.performedById ?? null,
      reference: { type: "STOCK_ADJUSTMENT" },
    });
  }

  return issueStock(tx, {
    productId: input.productId,
    warehouseId: input.warehouseId,
    binId: input.binId,
    lotId: input.lotId ?? null,
    quantity: delta.abs(),
    movementType: input.movementType ?? StockMovementType.ADJUSTMENT_OUT,
    reasonCode: input.reasonCode,
    notes: input.notes ?? null,
    performedById: input.performedById ?? null,
    reference: { type: "STOCK_ADJUSTMENT" },
  });
}
