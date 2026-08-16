import { prisma } from "@repo/db";
import {
  Prisma,
  PackageStatus,
  PickListStatus,
  PickingStrategy,
  ReservationReferenceType,
  StockMovementType,
  StockStatus,
  TaskStatus,
} from "@prisma/client";
import { nextDocumentNumber, SEQUENCE_KEYS } from "./numbering.service.js";
import {
  issueStock,
  moveStock,
  releaseReservations,
  sortCandidates,
} from "./stock.service.js";
import {
  DomainError,
  InsufficientStockError,
  NotFoundError,
} from "./errors.js";
import {
  ZERO,
  requirePositive,
  roundQuantity,
  sum,
  toDecimal,
} from "./decimal.js";

type Tx = Prisma.TransactionClient;

export interface PutawaySuggestion {
  binId: number;
  binCode: string;
  zoneName: string;
  reason: string;
  score: number;
  currentQuantity: Prisma.Decimal;
  remainingWeightKg: Prisma.Decimal | null;
}

/**
 * Rank the bins a receipt could be put away into.
 *
 * The ranking is deliberately simple and explainable, because a warehouse
 * supervisor has to be able to tell why the system suggested a location:
 *
 *  1. a bin that already holds this item consolidates the SKU;
 *  2. a pick face for this item keeps replenishment short;
 *  3. otherwise the emptiest bin in traversal order.
 *
 * Bins that cannot physically take the receipt — blocked, inactive, or over
 * their weight rating — are filtered out rather than scored down.
 */
export async function suggestPutawayBins(
  input: {
    productId: number;
    warehouseId: number;
    quantity: Prisma.Decimal | number | string;
    limit?: number;
  },
  client: Tx | typeof prisma = prisma
): Promise<PutawaySuggestion[]> {
  const quantity = requirePositive(input.quantity, "quantity");

  const product = await client.product.findUnique({
    where: { id: input.productId },
    select: { id: true, weightKg: true },
  });
  if (!product) throw new NotFoundError("Product");

  const bins = await client.storageBin.findMany({
    where: {
      warehouseId: input.warehouseId,
      isActive: true,
      isBlocked: false,
      isQuarantine: false,
      isShipping: false,
    },
    include: {
      zone: { select: { id: true, name: true, zoneType: true } },
      stockBalances: {
        select: {
          productId: true,
          quantity: true,
          product: { select: { weightKg: true } },
        },
      },
    },
    orderBy: { pickSequence: "asc" },
  });

  const incomingWeight = product.weightKg
    ? product.weightKg.times(quantity)
    : null;

  const suggestions: PutawaySuggestion[] = [];

  for (const bin of bins) {
    const currentWeight = bin.stockBalances.reduce(
      (acc, balance) =>
        acc.plus(balance.quantity.times(balance.product.weightKg ?? ZERO)),
      ZERO
    );

    let remainingWeight: Prisma.Decimal | null = null;
    if (bin.maxWeightKg) {
      remainingWeight = bin.maxWeightKg.minus(currentWeight);
      if (incomingWeight && remainingWeight.lessThan(incomingWeight)) {
        continue; // physically will not fit
      }
    }

    const sameItem = bin.stockBalances.filter(
      balance => balance.productId === input.productId
    );
    const currentQuantity = sum(sameItem.map(balance => balance.quantity));
    const otherItems = bin.stockBalances.filter(
      balance => balance.productId !== input.productId
    ).length;

    let score = 0;
    let reason: string;

    if (currentQuantity.greaterThan(0)) {
      score = 100 - Math.min(otherItems, 20);
      reason = `Already holds ${currentQuantity.toFixed(4)} of this item`;
    } else if (bin.isPickFace) {
      score = 70;
      reason = "Designated pick face";
    } else if (bin.stockBalances.length === 0) {
      score = 50;
      reason = "Empty bin";
    } else {
      score = 30 - Math.min(otherItems, 20);
      reason = `Mixed bin holding ${otherItems} other item(s)`;
    }

    // Earlier traversal positions break ties, so putaway walks the aisle in order.
    score -= Math.min(bin.pickSequence, 20) / 100;

    suggestions.push({
      binId: bin.id,
      binCode: bin.code,
      zoneName: bin.zone.name,
      reason,
      score,
      currentQuantity,
      remainingWeightKg: remainingWeight,
    });
  }

  suggestions.sort((a, b) => b.score - a.score);
  return suggestions.slice(0, input.limit ?? 5);
}

/**
 * Raise putaway work for goods sitting in a receiving bin. One task per
 * receipt line keeps the lot identity intact through the move.
 */
export async function createPutawayTask(
  tx: Tx,
  input: {
    warehouseId: number;
    productId: number;
    lotId: number;
    fromBinId: number;
    quantity: Prisma.Decimal | number | string;
    toBinId?: number | null;
    grnLineId?: number | null;
    assignedToId?: number | null;
    priority?: number;
    notes?: string | null;
  }
) {
  const quantity = requirePositive(input.quantity, "quantity");

  let toBinId = input.toBinId ?? null;
  if (!toBinId) {
    const [best] = await suggestPutawayBins(
      {
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantity,
        limit: 1,
      },
      tx
    );
    toBinId = best?.binId ?? null;
  }

  const taskNumber = await nextDocumentNumber(tx, SEQUENCE_KEYS.PUTAWAY_TASK);
  return tx.putawayTask.create({
    data: {
      taskNumber,
      warehouseId: input.warehouseId,
      productId: input.productId,
      lotId: input.lotId,
      fromBinId: input.fromBinId,
      toBinId,
      quantity: roundQuantity(quantity),
      status: input.assignedToId ? TaskStatus.ASSIGNED : TaskStatus.PENDING,
      priority: input.priority ?? 5,
      grnLineId: input.grnLineId ?? null,
      assignedToId: input.assignedToId ?? null,
      notes: input.notes ?? null,
    },
  });
}

/**
 * Complete a putaway: physically move the goods and close the task. A short
 * putaway is allowed and leaves the task open for the remainder.
 */
export async function completePutawayTask(
  tx: Tx,
  input: {
    taskId: number;
    toBinId?: number | null;
    quantity?: Prisma.Decimal | number | string;
    userId: number;
  }
) {
  const task = await tx.putawayTask.findUnique({ where: { id: input.taskId } });
  if (!task) throw new NotFoundError("Putaway task");
  if (
    task.status === TaskStatus.COMPLETED ||
    task.status === TaskStatus.CANCELLED
  ) {
    throw new DomainError(
      `Putaway task ${task.taskNumber} is already ${task.status.toLowerCase()}`,
      {
        code: "TASK_CLOSED",
      }
    );
  }

  const outstanding = task.quantity.minus(task.movedQuantity);
  const quantity = input.quantity
    ? toDecimal(input.quantity, "quantity")
    : outstanding;
  if (quantity.lessThanOrEqualTo(0)) {
    throw new DomainError("quantity must be greater than zero", {
      code: "VALIDATION_ERROR",
    });
  }
  if (quantity.greaterThan(outstanding)) {
    throw new DomainError(
      `Putaway task ${task.taskNumber} has only ${outstanding.toFixed(4)} left to move`,
      { code: "QUANTITY_EXCEEDS_TASK" }
    );
  }

  const toBinId = input.toBinId ?? task.toBinId;
  if (!toBinId) {
    throw new DomainError("A destination bin is required to complete putaway", {
      code: "DESTINATION_REQUIRED",
    });
  }

  await moveStock(tx, {
    productId: task.productId,
    lotId: task.lotId,
    quantity,
    fromWarehouseId: task.warehouseId,
    fromBinId: task.fromBinId,
    toWarehouseId: task.warehouseId,
    toBinId,
    reference: { type: "PUTAWAY_TASK", id: task.id, number: task.taskNumber },
    reasonCode: "PUTAWAY",
    performedById: input.userId,
  });

  const movedQuantity = roundQuantity(task.movedQuantity.plus(quantity));
  const completed = movedQuantity.greaterThanOrEqualTo(task.quantity);

  return tx.putawayTask.update({
    where: { id: task.id },
    data: {
      movedQuantity,
      toBinId,
      status: completed ? TaskStatus.COMPLETED : TaskStatus.IN_PROGRESS,
      completedById: completed ? input.userId : null,
      completedAt: completed ? new Date() : null,
    },
  });
}

export interface PickLineRequest {
  productId: number;
  quantity: Prisma.Decimal | number | string;
}

/**
 * Build a pick list for a demand document.
 *
 * Each requested line is allocated across the bins that actually hold stock,
 * in the order the item's picking strategy dictates, and the resulting tasks
 * are sequenced by bin traversal order so a picker walks the aisle once
 * rather than criss-crossing it. Stock is reserved as the list is created, so
 * two pick lists cannot be built against the same units.
 */
export async function createPickList(
  tx: Tx,
  input: {
    warehouseId: number;
    referenceType: string;
    referenceId: number;
    referenceNumber?: string | null;
    lines: PickLineRequest[];
    strategy?: PickingStrategy | null;
    assignedToId?: number | null;
    notes?: string | null;
    createdById: number;
  }
) {
  if (input.lines.length === 0) {
    throw new DomainError("A pick list needs at least one line", {
      code: "VALIDATION_ERROR",
    });
  }

  const warehouse = await tx.warehouse.findUnique({
    where: { id: input.warehouseId },
  });
  if (!warehouse) throw new NotFoundError("Warehouse");

  const pickListNumber = await nextDocumentNumber(tx, SEQUENCE_KEYS.PICK_LIST);
  const pickList = await tx.pickList.create({
    data: {
      pickListNumber,
      warehouseId: input.warehouseId,
      status: PickListStatus.DRAFT,
      strategy: input.strategy ?? PickingStrategy.FIFO,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      referenceNumber: input.referenceNumber ?? null,
      assignedToId: input.assignedToId ?? null,
      notes: input.notes ?? null,
    },
  });

  const plannedTasks: Array<{
    productId: number;
    lotId: number;
    binId: number;
    pickSequence: number;
    quantity: Prisma.Decimal;
  }> = [];

  // Sorting by product id keeps the advisory locks in a deterministic order.
  const sortedLines = [...input.lines].sort(
    (a, b) => a.productId - b.productId
  );

  for (const line of sortedLines) {
    const quantity = requirePositive(line.quantity, "quantity");
    const product = await tx.product.findUnique({
      where: { id: line.productId },
    });
    if (!product) throw new NotFoundError(`Product ${line.productId}`);

    const balances = await tx.stockBalance.findMany({
      where: {
        productId: line.productId,
        warehouseId: input.warehouseId,
        status: StockStatus.AVAILABLE,
        quantity: { gt: 0 },
        bin: { isActive: true, isBlocked: false },
      },
      include: {
        lot: true,
        bin: { select: { id: true, code: true, pickSequence: true } },
      },
    });

    const candidates = sortCandidates(
      balances
        .map(balance => ({
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
          availableQuantity: balance.quantity.minus(balance.reservedQuantity),
        }))
        .filter(candidate => candidate.availableQuantity.greaterThan(0)),
      input.strategy ?? product.pickingStrategy
    );

    const totalAvailable = sum(
      candidates.map(candidate => candidate.availableQuantity)
    );
    if (totalAvailable.lessThan(quantity)) {
      throw new InsufficientStockError(
        `Cannot build a pick list for ${product.code}: ${quantity.toFixed(4)} requested, ${totalAvailable.toFixed(4)} free in ${warehouse.code}`,
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

    let remaining = quantity;
    for (const candidate of candidates) {
      if (remaining.lessThanOrEqualTo(0)) break;
      const take = roundQuantity(
        Prisma.Decimal.min(remaining, candidate.availableQuantity)
      );
      if (take.lessThanOrEqualTo(0)) continue;

      const balance = balances.find(entry => entry.id === candidate.balanceId);
      if (!balance) continue;

      await tx.stockBalance.update({
        where: { id: balance.id },
        data: {
          reservedQuantity: roundQuantity(balance.reservedQuantity.plus(take)),
        },
      });

      await tx.stockReservation.create({
        data: {
          productId: line.productId,
          warehouseId: input.warehouseId,
          lotId: candidate.lotId,
          quantity: take,
          referenceType: ReservationReferenceType.PICK_LIST,
          referenceId: pickList.id,
          referenceNumber: pickList.pickListNumber,
          createdById: input.createdById,
        },
      });

      plannedTasks.push({
        productId: line.productId,
        lotId: candidate.lotId,
        binId: candidate.binId,
        pickSequence: balance.bin.pickSequence,
        quantity: take,
      });

      remaining = roundQuantity(remaining.minus(take));
    }
  }

  // Walk order: bin traversal sequence, then bin id for stability.
  plannedTasks.sort(
    (a, b) => a.pickSequence - b.pickSequence || a.binId - b.binId
  );

  for (const [index, task] of plannedTasks.entries()) {
    await tx.pickTask.create({
      data: {
        pickListId: pickList.id,
        productId: task.productId,
        lotId: task.lotId,
        binId: task.binId,
        sequence: index + 1,
        requestedQuantity: task.quantity,
      },
    });
  }

  return tx.pickList.findUniqueOrThrow({
    where: { id: pickList.id },
    include: {
      tasks: {
        orderBy: { sequence: "asc" },
        include: {
          product: { select: { id: true, code: true, name: true } },
          lot: {
            select: {
              id: true,
              lotNumber: true,
              batchNumber: true,
              serialNumber: true,
              expiryDate: true,
            },
          },
          bin: {
            select: {
              id: true,
              code: true,
              aisle: true,
              rack: true,
              level: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Confirm a pick. The stock leaves the bin and the ledger records it against
 * the lot the picker actually took, which is what makes lot traceability
 * survive the warehouse floor.
 */
export async function confirmPick(
  tx: Tx,
  input: {
    pickTaskId: number;
    quantity?: Prisma.Decimal | number | string;
    userId: number;
    notes?: string | null;
  }
) {
  const task = await tx.pickTask.findUnique({
    where: { id: input.pickTaskId },
    include: { pickList: true },
  });
  if (!task) throw new NotFoundError("Pick task");
  if (
    task.status === TaskStatus.COMPLETED ||
    task.status === TaskStatus.CANCELLED
  ) {
    throw new DomainError(`Pick task is already ${task.status.toLowerCase()}`, {
      code: "TASK_CLOSED",
    });
  }
  if (task.pickList.status === PickListStatus.CANCELLED) {
    throw new DomainError("This pick list has been cancelled", {
      code: "PICK_LIST_CANCELLED",
    });
  }

  const outstanding = task.requestedQuantity.minus(task.pickedQuantity);
  const quantity = input.quantity
    ? toDecimal(input.quantity, "quantity")
    : outstanding;
  if (quantity.lessThanOrEqualTo(0)) {
    throw new DomainError("quantity must be greater than zero", {
      code: "VALIDATION_ERROR",
    });
  }
  if (quantity.greaterThan(outstanding)) {
    throw new DomainError(
      `Only ${outstanding.toFixed(4)} is left to pick on this task`,
      {
        code: "QUANTITY_EXCEEDS_TASK",
      }
    );
  }

  await issueStock(tx, {
    productId: task.productId,
    warehouseId: task.pickList.warehouseId,
    binId: task.binId,
    lotId: task.lotId,
    quantity,
    movementType: StockMovementType.SALES_ISSUE,
    reference: {
      type: task.pickList.referenceType,
      id: task.pickList.referenceId,
      number: task.pickList.referenceNumber,
    },
    reasonCode: "PICK",
    notes: input.notes ?? null,
    performedById: input.userId,
    consumeReservedQuantity: true,
  });

  const pickedQuantity = roundQuantity(task.pickedQuantity.plus(quantity));
  const complete = pickedQuantity.greaterThanOrEqualTo(task.requestedQuantity);

  const updated = await tx.pickTask.update({
    where: { id: task.id },
    data: {
      pickedQuantity,
      shortQuantity: roundQuantity(
        task.requestedQuantity.minus(pickedQuantity)
      ),
      status: complete ? TaskStatus.COMPLETED : TaskStatus.IN_PROGRESS,
      pickedById: input.userId,
      pickedAt: new Date(),
      notes: input.notes ?? task.notes,
    },
  });

  // Roll the header status forward once every task is done.
  const remaining = await tx.pickTask.count({
    where: {
      pickListId: task.pickListId,
      status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
    },
  });
  if (remaining === 0) {
    await tx.pickList.update({
      where: { id: task.pickListId },
      data: { status: PickListStatus.PICKED, completedAt: new Date() },
    });
  } else if (task.pickList.status === PickListStatus.RELEASED) {
    await tx.pickList.update({
      where: { id: task.pickListId },
      data: { status: PickListStatus.IN_PROGRESS },
    });
  }

  return updated;
}

/** Release a pick list to the floor so pickers can start on it. */
export async function releasePickList(
  tx: Tx,
  pickListId: number,
  userId: number
) {
  const pickList = await tx.pickList.findUnique({ where: { id: pickListId } });
  if (!pickList) throw new NotFoundError("Pick list");
  if (pickList.status !== PickListStatus.DRAFT) {
    throw new DomainError(
      `Only a draft pick list can be released; this one is ${pickList.status.toLowerCase()}`,
      {
        code: "INVALID_STATUS",
      }
    );
  }
  return tx.pickList.update({
    where: { id: pickListId },
    data: {
      status: PickListStatus.RELEASED,
      releasedById: userId,
      releasedAt: new Date(),
    },
  });
}

/** Cancel a pick list and hand its reserved stock back. */
export async function cancelPickList(tx: Tx, pickListId: number) {
  const pickList = await tx.pickList.findUnique({
    where: { id: pickListId },
    include: { tasks: true },
  });
  if (!pickList) throw new NotFoundError("Pick list");
  if (pickList.status === PickListStatus.SHIPPED) {
    throw new DomainError("A shipped pick list cannot be cancelled", {
      code: "INVALID_STATUS",
    });
  }

  await releaseReservations(tx, {
    referenceType: ReservationReferenceType.PICK_LIST,
    referenceId: pickListId,
  });

  await tx.pickTask.updateMany({
    where: { pickListId, status: { notIn: [TaskStatus.COMPLETED] } },
    data: { status: TaskStatus.CANCELLED },
  });

  return tx.pickList.update({
    where: { id: pickListId },
    data: { status: PickListStatus.CANCELLED },
  });
}

/**
 * Pack picked goods into a carton or onto a pallet. Only quantities that have
 * actually been picked can be packed, so a packing slip can never overstate
 * what left the building.
 */
export async function packPickedGoods(
  tx: Tx,
  input: {
    pickListId: number;
    lines: Array<{
      pickTaskId: number;
      quantity: Prisma.Decimal | number | string;
    }>;
    palletId?: number | null;
    grossWeightKg?: Prisma.Decimal | number | string | null;
    lengthCm?: Prisma.Decimal | number | string | null;
    widthCm?: Prisma.Decimal | number | string | null;
    heightCm?: Prisma.Decimal | number | string | null;
    carrier?: string | null;
    trackingNumber?: string | null;
    userId: number;
  }
) {
  const pickList = await tx.pickList.findUnique({
    where: { id: input.pickListId },
    include: { tasks: true },
  });
  if (!pickList) throw new NotFoundError("Pick list");
  if (input.lines.length === 0) {
    throw new DomainError("A package needs at least one line", {
      code: "VALIDATION_ERROR",
    });
  }

  const packageNumber = await nextDocumentNumber(tx, SEQUENCE_KEYS.PACKAGE);
  const created = await tx.package.create({
    data: {
      packageNumber,
      pickListId: input.pickListId,
      palletId: input.palletId ?? null,
      status: PackageStatus.PACKED,
      grossWeightKg: input.grossWeightKg
        ? toDecimal(input.grossWeightKg, "grossWeightKg")
        : null,
      lengthCm: input.lengthCm ? toDecimal(input.lengthCm, "lengthCm") : null,
      widthCm: input.widthCm ? toDecimal(input.widthCm, "widthCm") : null,
      heightCm: input.heightCm ? toDecimal(input.heightCm, "heightCm") : null,
      carrier: input.carrier ?? null,
      trackingNumber: input.trackingNumber ?? null,
      packedById: input.userId,
      packedAt: new Date(),
    },
  });

  for (const line of input.lines) {
    const task = pickList.tasks.find(entry => entry.id === line.pickTaskId);
    if (!task)
      throw new NotFoundError(`Pick task ${line.pickTaskId} on this pick list`);

    const quantity = requirePositive(line.quantity, "quantity");

    const alreadyPacked = await tx.packageLine.aggregate({
      where: { pickTaskId: task.id },
      _sum: { quantity: true },
    });
    const packable = task.pickedQuantity.minus(
      alreadyPacked._sum.quantity ?? ZERO
    );
    if (quantity.greaterThan(packable)) {
      throw new DomainError(
        `Only ${packable.toFixed(4)} of pick task ${task.id} has been picked and is still unpacked`,
        { code: "QUANTITY_EXCEEDS_PICKED" }
      );
    }

    await tx.packageLine.create({
      data: {
        packageId: created.id,
        pickTaskId: task.id,
        productId: task.productId,
        lotId: task.lotId,
        quantity,
      },
    });
  }

  if (input.palletId) {
    await tx.pallet.update({
      where: { id: input.palletId },
      data: { status: "STAGED" },
    });
  }

  const outstanding = await tx.pickTask.count({
    where: {
      pickListId: input.pickListId,
      status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
    },
  });
  if (outstanding === 0) {
    await tx.pickList.update({
      where: { id: input.pickListId },
      data: { status: PickListStatus.PACKED },
    });
  }

  return tx.package.findUniqueOrThrow({
    where: { id: created.id },
    include: {
      lines: {
        include: {
          product: { select: { id: true, code: true, name: true } },
          lot: { select: { id: true, lotNumber: true } },
        },
      },
    },
  });
}

/** Mark packages as gone and close out the pick list. */
export async function shipPackages(
  tx: Tx,
  input: { packageIds: number[]; pickListId: number }
) {
  if (input.packageIds.length === 0) {
    throw new DomainError("At least one package is required", {
      code: "VALIDATION_ERROR",
    });
  }

  await tx.package.updateMany({
    where: { id: { in: input.packageIds }, pickListId: input.pickListId },
    data: { status: PackageStatus.SHIPPED, shippedAt: new Date() },
  });

  const open = await tx.package.count({
    where: {
      pickListId: input.pickListId,
      status: { notIn: [PackageStatus.SHIPPED, PackageStatus.CANCELLED] },
    },
  });
  if (open === 0) {
    await tx.pickList.update({
      where: { id: input.pickListId },
      data: { status: PickListStatus.SHIPPED },
    });
  }

  return open;
}

/**
 * Bin utilisation for a warehouse: how full each location is by weight and by
 * distinct items, so a supervisor can spot congestion before it bites.
 */
export async function getStorageUtilisation(warehouseId: number) {
  const bins = await prisma.storageBin.findMany({
    where: { warehouseId, isActive: true },
    include: {
      zone: { select: { id: true, code: true, name: true, zoneType: true } },
      stockBalances: {
        select: {
          productId: true,
          quantity: true,
          product: { select: { weightKg: true, volumeM3: true } },
        },
      },
    },
    orderBy: { pickSequence: "asc" },
  });

  const rows = bins.map(bin => {
    const usedWeight = bin.stockBalances.reduce(
      (acc, balance) =>
        acc.plus(balance.quantity.times(balance.product.weightKg ?? ZERO)),
      ZERO
    );
    const usedVolume = bin.stockBalances.reduce(
      (acc, balance) =>
        acc.plus(balance.quantity.times(balance.product.volumeM3 ?? ZERO)),
      ZERO
    );
    const distinctItems = new Set(
      bin.stockBalances.map(balance => balance.productId)
    ).size;
    const totalQuantity = sum(
      bin.stockBalances.map(balance => balance.quantity)
    );

    return {
      binId: bin.id,
      binCode: bin.code,
      zone: bin.zone,
      aisle: bin.aisle,
      rack: bin.rack,
      level: bin.level,
      binType: bin.binType,
      isPickFace: bin.isPickFace,
      isBlocked: bin.isBlocked,
      distinctItems,
      totalQuantity,
      usedWeightKg: usedWeight.toDecimalPlaces(4),
      maxWeightKg: bin.maxWeightKg,
      weightUtilisationPercent:
        bin.maxWeightKg && bin.maxWeightKg.greaterThan(0)
          ? usedWeight.dividedBy(bin.maxWeightKg).times(100).toDecimalPlaces(2)
          : null,
      usedVolumeM3: usedVolume.toDecimalPlaces(6),
      maxVolumeM3: bin.maxVolumeM3,
      volumeUtilisationPercent:
        bin.maxVolumeM3 && bin.maxVolumeM3.greaterThan(0)
          ? usedVolume.dividedBy(bin.maxVolumeM3).times(100).toDecimalPlaces(2)
          : null,
      isEmpty: totalQuantity.isZero(),
    };
  });

  return {
    warehouseId,
    totalBins: rows.length,
    emptyBins: rows.filter(row => row.isEmpty).length,
    blockedBins: rows.filter(row => row.isBlocked).length,
    binsOverCapacity: rows.filter(
      row =>
        row.weightUtilisationPercent !== null &&
        row.weightUtilisationPercent.greaterThan(100)
    ).length,
    rows,
  };
}
