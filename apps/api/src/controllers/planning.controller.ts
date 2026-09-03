import { Request, Response } from "express";
import { Prisma, WorkCenterType } from "@prisma/client";
import { prisma } from "@repo/db";

import {
  requireNonNegative,
  requirePercentage,
  requirePositive,
} from "../services/supplyChain/decimal.js";
import { DomainError, NotFoundError } from "../services/supplyChain/errors.js";
import {
  parseBoundedInteger,
  parsePositiveInteger,
} from "../utils/validators.js";
import {
  handleSupplyChainError,
  optionalString,
  parseBoolean,
  parseEnum,
  parseInteger,
  parseOptionalInteger,
  requireString,
} from "../utils/supply-chain-http.js";

const parseId = (value: unknown) => parsePositiveInteger(value) ?? undefined;

function effectiveCapacity(wc: {
  capacityMinutesPerDay: number;
  efficiencyPercent: Prisma.Decimal | number | string;
  parallelCapacity: number;
}) {
  const eff = Number(
    requirePercentage(wc.efficiencyPercent, "efficiencyPercent")
  );
  if (wc.capacityMinutesPerDay <= 0 || wc.parallelCapacity <= 0) {
    throw new DomainError("Work centre capacity must be greater than zero", {
      code: "INVALID_WORK_CENTER_CAPACITY",
    });
  }
  return Math.round(
    wc.capacityMinutesPerDay * (eff / 100) * wc.parallelCapacity
  );
}

function operationMinutes(
  op: {
    setupMinutes: number;
    runMinutesPerUnit: Prisma.Decimal | number | string;
  },
  quantity: number
) {
  const run = Number(
    requireNonNegative(op.runMinutesPerUnit, "runMinutesPerUnit")
  );
  return Math.ceil(op.setupMinutes + run * quantity);
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

async function assertRoutingEditable(bomId: number) {
  const bom = await prisma.billOfMaterials.findUnique({
    where: { id: bomId },
    select: { id: true, status: true, bomNumber: true },
  });
  if (!bom) throw new NotFoundError("Bill of materials");
  if (bom.status === "ACTIVE" || bom.status === "OBSOLETE") {
    throw new DomainError(
      `${bom.bomNumber} is ${bom.status.toLowerCase()} and frozen. Create a revision to change its routing.`,
      { code: "BOM_FROZEN" }
    );
  }
  return bom;
}

async function assertSequenceFree(
  bomId: number,
  sequence: number,
  exceptId?: number
) {
  const clash = await prisma.bomOperation.findFirst({
    where: {
      bomId,
      sequence,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { name: true },
  });
  if (clash) {
    throw new DomainError(
      `Step ${sequence} is already taken by "${clash.name}". Give this one a different number.`,
      { code: "SEQUENCE_TAKEN" }
    );
  }
}

export class PlanningController {
  async listWorkCenters(req: Request, res: Response) {
    const operation = "List work centres";
    try {
      const warehouseId = parseId(req.query.warehouseId);
      const rows = await prisma.workCenter.findMany({
        where: {
          ...(warehouseId ? { warehouseId } : {}),
          ...(req.query.activeOnly === "true" ? { isActive: true } : {}),
        },
        orderBy: { code: "asc" },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          _count: { select: { operations: true, scheduled: true } },
        },
      });
      res.json({
        data: rows.map(row => ({
          ...row,
          effectiveMinutesPerDay: effectiveCapacity(row),
        })),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async createWorkCenter(req: Request, res: Response) {
    const operation = "Create work centre";
    try {
      const {
        code,
        name,
        warehouseId,
        type,
        description,
        capacityMinutesPerDay,
        efficiencyPercent,
        costPerHour,
        parallelCapacity,
      } = req.body ?? {};

      const wh = parseId(warehouseId);
      if (!wh) throw new DomainError("A warehouse is required.");

      const created = await prisma.workCenter.create({
        data: {
          code: requireString(code, "code", 50).toUpperCase(),
          name: requireString(name, "name", 200),
          warehouseId: wh,
          type:
            parseEnum(WorkCenterType, type, "type") ?? WorkCenterType.MACHINE,
          description: optionalString(description, "description"),
          capacityMinutesPerDay:
            parseOptionalInteger(
              capacityMinutesPerDay,
              "capacityMinutesPerDay",
              1,
              10_080
            ) ?? 480,
          efficiencyPercent: requirePercentage(
            efficiencyPercent ?? 85,
            "efficiencyPercent"
          ),
          costPerHour: requireNonNegative(costPerHour ?? 0, "costPerHour"),
          parallelCapacity:
            parseOptionalInteger(
              parallelCapacity,
              "parallelCapacity",
              1,
              1_000
            ) ?? 1,
        },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
        },
      });

      res.status(201).json({
        data: {
          ...created,
          effectiveMinutesPerDay: effectiveCapacity(created),
          _count: { operations: 0, scheduled: 0 },
        },
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async listBomOperations(req: Request, res: Response) {
    const operation = "List BOM operations";
    try {
      const bomId = parseId(req.params.bomId);
      if (!bomId) throw new DomainError("Invalid BOM id.");
      const rows = await prisma.bomOperation.findMany({
        where: { bomId },
        orderBy: { sequence: "asc" },
        include: {
          workCenter: {
            select: { id: true, code: true, name: true, costPerHour: true },
          },
        },
      });
      res.json({ data: rows });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async addBomOperation(req: Request, res: Response) {
    const operation = "Add BOM operation";
    try {
      const bomId = parseId(req.params.bomId);
      if (!bomId) throw new DomainError("Invalid BOM id.");
      const {
        workCenterId,
        name,
        description,
        sequence,
        setupMinutes,
        runMinutesPerUnit,
        isBlocking,
      } = req.body ?? {};

      await assertRoutingEditable(bomId);

      const wc = parseId(workCenterId);
      if (!wc) throw new DomainError("A work centre is required.");

      const next =
        sequence === undefined || sequence === null || sequence === ""
          ? ((
              await prisma.bomOperation.aggregate({
                where: { bomId },
                _max: { sequence: true },
              })
            )._max.sequence ?? 0) + 10
          : parseInteger(sequence, "sequence", 1, 1_000_000);
      await assertSequenceFree(bomId, next);

      const created = await prisma.bomOperation.create({
        data: {
          bomId,
          workCenterId: wc,
          sequence: next,
          name: requireString(name, "name", 200),
          description: optionalString(description, "description"),
          setupMinutes:
            parseOptionalInteger(setupMinutes, "setupMinutes", 0, 1_000_000) ??
            0,
          runMinutesPerUnit: requireNonNegative(
            runMinutesPerUnit ?? 0,
            "runMinutesPerUnit"
          ),
          isBlocking: parseBoolean(isBlocking, "isBlocking") ?? true,
        },
        include: {
          workCenter: {
            select: { id: true, code: true, name: true, costPerHour: true },
          },
        },
      });
      res.status(201).json({ data: created });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async updateBomOperation(req: Request, res: Response) {
    const operation = "Update BOM operation";
    try {
      const bomId = parseId(req.params.bomId);
      const operationId = parseId(req.params.operationId);
      if (!bomId || !operationId)
        throw new DomainError("Invalid BOM or operation id.");
      await assertRoutingEditable(bomId);

      const existing = await prisma.bomOperation.findUnique({
        where: { id: operationId },
        select: { id: true, bomId: true },
      });

      if (!existing || existing.bomId !== bomId)
        throw new NotFoundError("Routing operation");

      const {
        workCenterId,
        name,
        description,
        sequence,
        setupMinutes,
        runMinutesPerUnit,
        isBlocking,
      } = req.body ?? {};

      const nextSequence = parseOptionalInteger(
        sequence,
        "sequence",
        1,
        1_000_000
      );
      if (nextSequence !== null) {
        await assertSequenceFree(bomId, nextSequence, operationId);
      }
      const wc = workCenterId === undefined ? undefined : parseId(workCenterId);
      if (workCenterId !== undefined && !wc)
        throw new DomainError("A work centre is required.");

      const updated = await prisma.bomOperation.update({
        where: { id: operationId },
        data: {
          ...(wc ? { workCenterId: wc } : {}),
          ...(name !== undefined
            ? { name: requireString(name, "name", 200) }
            : {}),
          ...(description !== undefined
            ? { description: optionalString(description, "description") }
            : {}),
          ...(nextSequence !== null ? { sequence: nextSequence } : {}),
          ...(setupMinutes !== undefined
            ? {
                setupMinutes: parseInteger(
                  setupMinutes,
                  "setupMinutes",
                  0,
                  1_000_000
                ),
              }
            : {}),
          ...(runMinutesPerUnit !== undefined
            ? {
                runMinutesPerUnit: requireNonNegative(
                  runMinutesPerUnit,
                  "runMinutesPerUnit"
                ),
              }
            : {}),
          ...(isBlocking !== undefined
            ? { isBlocking: parseBoolean(isBlocking, "isBlocking") }
            : {}),
        },
        include: {
          workCenter: {
            select: { id: true, code: true, name: true, costPerHour: true },
          },
        },
      });
      res.json({ data: updated });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async deleteBomOperation(req: Request, res: Response) {
    const operation = "Remove BOM operation";
    try {
      const bomId = parseId(req.params.bomId);
      const operationId = parseId(req.params.operationId);
      if (!bomId || !operationId)
        throw new DomainError("Invalid BOM or operation id.");
      await assertRoutingEditable(bomId);

      const existing = await prisma.bomOperation.findUnique({
        where: { id: operationId },
        select: { id: true, bomId: true, name: true },
      });
      if (!existing || existing.bomId !== bomId)
        throw new NotFoundError("Routing operation");

      await prisma.bomOperation.delete({ where: { id: operationId } });
      res.json({ data: { id: operationId, name: existing.name } });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async scheduleOrder(req: Request, res: Response) {
    const operation = "Schedule production order";
    try {
      const id = parseId(req.params.id);
      if (!id) throw new DomainError("Invalid production order id.");

      const order = await prisma.productionOrder.findUnique({
        where: { id },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          bomId: true,
          plannedQuantity: true,
          plannedStartDate: true,
        },
      });
      if (!order) throw new NotFoundError("Production order");
      if (order.status === "COMPLETED" || order.status === "CANCELLED") {
        throw new DomainError(
          `${order.orderNumber} is ${order.status.toLowerCase()} and cannot be rescheduled.`
        );
      }

      const routing = await prisma.bomOperation.findMany({
        where: { bomId: order.bomId },
        orderBy: { sequence: "asc" },
        include: {
          workCenter: { select: { id: true, code: true, name: true } },
        },
      });
      if (routing.length === 0) {
        throw new DomainError(
          "This order's bill of materials has no routing. Add operations to it before scheduling."
        );
      }

      const quantity = Number(
        requirePositive(order.plannedQuantity, "plannedQuantity")
      );
      let cursor = order.plannedStartDate
        ? new Date(order.plannedStartDate)
        : new Date();

      const result = await prisma.$transaction(async tx => {
        await tx.productionOrderOperation.deleteMany({
          where: { productionOrderId: id },
        });

        const created = [];
        for (const op of routing) {
          const minutes = operationMinutes(op, quantity);
          const start = new Date(cursor);
          const end = new Date(start.getTime() + minutes * 60_000);
          created.push(
            await tx.productionOrderOperation.create({
              data: {
                productionOrderId: id,
                workCenterId: op.workCenterId,
                sequence: op.sequence,
                name: op.name,
                status: "SCHEDULED",
                plannedMinutes: minutes,
                scheduledStart: start,
                scheduledEnd: end,
              },
              include: { workCenter: { select: { code: true, name: true } } },
            })
          );

          if (op.isBlocking) cursor = end;
        }

        const last = created[created.length - 1];
        await tx.productionOrder.update({
          where: { id },
          data: {
            plannedStartDate: created[0]?.scheduledStart ?? undefined,
            plannedEndDate: last?.scheduledEnd ?? undefined,
          },
        });
        return created;
      });

      res.json({
        data: {
          orderNumber: order.orderNumber,
          operations: result,
          totalMinutes: result.reduce((a, o) => a + o.plannedMinutes, 0),
        },
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async orderOperations(req: Request, res: Response) {
    const operation = "Production order operations";
    try {
      const id = parseId(req.params.id);
      if (!id) throw new DomainError("Invalid production order id.");
      const rows = await prisma.productionOrderOperation.findMany({
        where: { productionOrderId: id },
        orderBy: { sequence: "asc" },
        include: {
          workCenter: {
            select: { id: true, code: true, name: true, costPerHour: true },
          },
        },
      });
      res.json({ data: rows });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async capacityLoad(req: Request, res: Response) {
    const operation = "Capacity load";
    try {
      const days =
        req.query.days === undefined
          ? 14
          : parseBoundedInteger(req.query.days, 1, 60);
      if (days === null) {
        throw new DomainError("days must be an integer between 1 and 60", {
          code: "INVALID_PLANNING_HORIZON",
        });
      }
      const warehouseId = parseId(req.query.warehouseId);
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from.getTime() + days * 86_400_000);

      const centres = await prisma.workCenter.findMany({
        where: { isActive: true, ...(warehouseId ? { warehouseId } : {}) },
        orderBy: { code: "asc" },
        include: { warehouse: { select: { code: true } } },
      });

      const scheduled = await prisma.productionOrderOperation.findMany({
        where: {
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
          scheduledStart: { gte: from, lt: to },
          ...(warehouseId ? { workCenter: { warehouseId } } : {}),
        },
        include: {
          productionOrder: {
            select: {
              id: true,
              orderNumber: true,
              product: { select: { code: true, name: true } },
            },
          },
          workCenter: { select: { id: true, code: true } },
        },
        orderBy: { scheduledStart: "asc" },
      });

      const dayList: string[] = [];
      for (let i = 0; i < days; i++) {
        dayList.push(dayKey(new Date(from.getTime() + i * 86_400_000)));
      }

      const rows = centres.map(wc => {
        const capacity = effectiveCapacity(wc);
        const perDay: Record<string, number> = Object.fromEntries(
          dayList.map(d => [d, 0])
        );
        for (const op of scheduled) {
          if (op.workCenterId !== wc.id || !op.scheduledStart) continue;
          const key = dayKey(new Date(op.scheduledStart));
          if (key in perDay) perDay[key]! += op.plannedMinutes;
        }
        const committed = Object.values(perDay).reduce((a, b) => a + b, 0);
        const available = capacity * days;
        return {
          workCenter: {
            id: wc.id,
            code: wc.code,
            name: wc.name,
            type: wc.type,
            warehouse: wc.warehouse.code,
          },
          capacityMinutesPerDay: capacity,
          days: dayList.map(d => ({
            date: d,
            minutes: perDay[d]!,
            utilisationPercent: capacity
              ? Math.round((perDay[d]! / capacity) * 1000) / 10
              : 0,
            overloaded: perDay[d]! > capacity,
          })),
          committedMinutes: committed,
          availableMinutes: available,
          utilisationPercent: available
            ? Math.round((committed / available) * 1000) / 10
            : 0,
          overloadedDays: dayList.filter(d => perDay[d]! > capacity).length,
        };
      });

      res.json({
        data: {
          from,
          to,
          days: dayList,
          workCenters: rows,
          scheduledOperations: scheduled.length,
          overloadedCentres: rows.filter(r => r.overloadedDays > 0).length,
        },
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async board(req: Request, res: Response) {
    const operation = "Planning board";
    try {
      const orders = await prisma.productionOrder.findMany({
        where: {
          status: { in: ["DRAFT", "PLANNED", "RELEASED", "IN_PROGRESS"] },
        },
        orderBy: [{ plannedStartDate: "asc" }, { id: "asc" }],
        include: {
          product: { select: { id: true, code: true, name: true } },
          warehouse: { select: { code: true } },
          bom: {
            select: {
              id: true,
              bomNumber: true,
              _count: { select: { operations: true } },
            },
          },
          operations: {
            orderBy: { sequence: "asc" },
            select: {
              id: true,
              sequence: true,
              name: true,
              status: true,
              plannedMinutes: true,
              scheduledStart: true,
              scheduledEnd: true,
              workCenter: { select: { code: true, name: true } },
            },
          },
        },
      });

      res.json({
        data: orders.map(o => {
          const totalMinutes = o.operations.reduce(
            (a, x) => a + x.plannedMinutes,
            0
          );
          return {
            ...o,
            isScheduled: o.operations.length > 0,

            canSchedule: (o.bom?._count.operations ?? 0) > 0,
            totalMinutes,
            totalHours: Math.round((totalMinutes / 60) * 10) / 10,
          };
        }),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }
}
