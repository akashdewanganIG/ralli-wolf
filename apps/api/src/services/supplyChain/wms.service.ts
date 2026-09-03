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
import { ZERO, requirePositive, roundQuantity, sum } from "./decimal.js";

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
        continue;
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

export async function completePutawayTask(
  tx: Tx,
  input: {
    taskId: number;
    toBinId?: number | null;
    quantity?: Prisma.Decimal | number | string;
    userId: number;
  }
) {
  await tx.$queryRaw`
    SELECT "id" FROM "putaway_tasks" WHERE "id" = ${input.taskId} FOR UPDATE
  `;
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
  const quantity =
    input.quantity === undefined || input.quantity === null
      ? requirePositive(outstanding, "quantity")
      : requirePositive(input.quantity, "quantity");
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

export async function confirmPick(
  tx: Tx,
  input: {
    pickTaskId: number;
    quantity?: Prisma.Decimal | number | string;
    userId: number;
    notes?: string | null;
  }
) {
  await tx.$queryRaw`
    SELECT "id" FROM "pick_tasks" WHERE "id" = ${input.pickTaskId} FOR UPDATE
  `;
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
  const quantity =
    input.quantity === undefined || input.quantity === null
      ? requirePositive(outstanding, "quantity")
      : requirePositive(input.quantity, "quantity");
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

export async function cancelPickList(tx: Tx, pickListId: number) {
  const pickList = await tx.pickList.findUnique({
    where: { id: pickListId },
    include: { tasks: true },
  });
  if (!pickList) throw new NotFoundError("Pick list");
  if (
    !(<PickListStatus[]>[
      PickListStatus.IN_PROGRESS,
      PickListStatus.PICKED,
      PickListStatus.PACKED,
    ]).includes(pickList.status)
  ) {
    throw new DomainError(
      `Pick list ${pickList.pickListNumber} cannot be packed while ${pickList.status.toLowerCase()}`,
      { status: 409, code: "PICK_LIST_NOT_PACKABLE" }
    );
  }
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
  if (input.lines.length === 0) {
    throw new DomainError("A package needs at least one line", {
      code: "VALIDATION_ERROR",
    });
  }
  const taskIds = input.lines.map(line => line.pickTaskId);
  if (new Set(taskIds).size !== taskIds.length) {
    throw new DomainError("A pick task can appear only once in a package", {
      code: "DUPLICATE_PICK_TASK",
    });
  }
  await tx.$queryRaw`
    SELECT "id" FROM "pick_lists" WHERE "id" = ${input.pickListId} FOR UPDATE
  `;
  await tx.$queryRaw`
    SELECT "id" FROM "pick_tasks"
    WHERE "id" IN (${Prisma.join([...taskIds].sort((a, b) => a - b))})
    ORDER BY "id"
    FOR UPDATE
  `;
  const pickList = await tx.pickList.findUnique({
    where: { id: input.pickListId },
    include: { tasks: true },
  });
  if (!pickList) throw new NotFoundError("Pick list");

  const packageNumber = await nextDocumentNumber(tx, SEQUENCE_KEYS.PACKAGE);
  const created = await tx.package.create({
    data: {
      packageNumber,
      pickListId: input.pickListId,
      palletId: input.palletId ?? null,
      status: PackageStatus.PACKED,
      grossWeightKg:
        input.grossWeightKg === undefined || input.grossWeightKg === null
          ? null
          : requirePositive(input.grossWeightKg, "grossWeightKg"),
      lengthCm:
        input.lengthCm === undefined || input.lengthCm === null
          ? null
          : requirePositive(input.lengthCm, "lengthCm"),
      widthCm:
        input.widthCm === undefined || input.widthCm === null
          ? null
          : requirePositive(input.widthCm, "widthCm"),
      heightCm:
        input.heightCm === undefined || input.heightCm === null
          ? null
          : requirePositive(input.heightCm, "heightCm"),
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
  const packedByTask = await tx.packageLine.groupBy({
    by: ["pickTaskId"],
    where: {
      pickTask: { pickListId: input.pickListId },
      package: { status: { not: PackageStatus.CANCELLED } },
    },
    _sum: { quantity: true },
  });
  const packedQuantities = new Map(
    packedByTask.map(row => [row.pickTaskId, row._sum.quantity ?? ZERO])
  );
  const hasUnpackedQuantity = pickList.tasks.some(task =>
    task.pickedQuantity.greaterThan(packedQuantities.get(task.id) ?? ZERO)
  );
  await tx.pickList.update({
    where: { id: input.pickListId },
    data: {
      status:
        outstanding > 0
          ? PickListStatus.IN_PROGRESS
          : hasUnpackedQuantity
            ? PickListStatus.PICKED
            : PickListStatus.PACKED,
    },
  });

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

export async function shipPackages(
  tx: Tx,
  input: { packageIds: number[]; pickListId: number }
) {
  if (input.packageIds.length === 0) {
    throw new DomainError("At least one package is required", {
      code: "VALIDATION_ERROR",
    });
  }
  if (new Set(input.packageIds).size !== input.packageIds.length) {
    throw new DomainError("packageIds cannot contain duplicates", {
      code: "VALIDATION_ERROR",
    });
  }
  const orderedIds = [...input.packageIds].sort((a, b) => a - b);
  await tx.$queryRaw`
    SELECT "id" FROM "pick_lists" WHERE "id" = ${input.pickListId} FOR UPDATE
  `;
  await tx.$queryRaw`
    SELECT "id" FROM "packages"
    WHERE "id" IN (${Prisma.join(orderedIds)})
    ORDER BY "id"
    FOR UPDATE
  `;
  const pickList = await tx.pickList.findUnique({
    where: { id: input.pickListId },
    select: { id: true, pickListNumber: true, status: true },
  });
  if (!pickList) throw new NotFoundError("Pick list");
  if (pickList.status !== PickListStatus.PACKED) {
    throw new DomainError(
      `Pick list ${pickList.pickListNumber} must be fully packed before shipping`,
      { status: 409, code: "PICK_LIST_NOT_PACKED" }
    );
  }
  const packages = await tx.package.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true, pickListId: true, status: true },
  });
  if (packages.length !== orderedIds.length) {
    throw new NotFoundError("One or more packages");
  }
  const invalid = packages.find(
    entry =>
      entry.pickListId !== input.pickListId ||
      entry.status !== PackageStatus.PACKED
  );
  if (invalid) {
    throw new DomainError(
      `Package ${invalid.id} does not belong to this pick list or is not ready to ship`,
      { status: 409, code: "PACKAGE_NOT_SHIPPABLE" }
    );
  }

  const shipped = await tx.package.updateMany({
    where: {
      id: { in: orderedIds },
      pickListId: input.pickListId,
      status: PackageStatus.PACKED,
    },
    data: { status: PackageStatus.SHIPPED, shippedAt: new Date() },
  });
  if (shipped.count !== orderedIds.length) {
    throw new DomainError("Package state changed while shipping", {
      status: 409,
      code: "PACKAGE_STATE_CHANGED",
    });
  }

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
