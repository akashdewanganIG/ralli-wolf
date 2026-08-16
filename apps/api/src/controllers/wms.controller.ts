import { Request, Response } from "express";
import { prisma } from "@repo/db";
import {
  Prisma,
  PackageStatus,
  PickListStatus,
  PickingStrategy,
  TaskStatus,
} from "@prisma/client";
import {
  cancelPickList,
  completePutawayTask,
  confirmPick,
  createPickList,
  packPickedGoods,
  releasePickList,
  shipPackages,
  suggestPutawayBins,
} from "../services/supplyChain/wms.service.js";
import { NotFoundError } from "../services/supplyChain/errors.js";
import {
  handleSupplyChainError,
  optionalString,
  paginationMeta,
  parseEnum,
  parseId,
  parseOptionalId,
  parsePagination,
  requireArray,
  requireUserId,
} from "../utils/supplyChainHttp.js";

export class WmsController {
  // ---------------------------------------------------------------- putaway

  /** GET /api/wms/putaway-tasks */
  async listPutawayTasks(req: Request, res: Response) {
    const operation = "List putaway tasks";
    try {
      const pagination = parsePagination(req, 25);
      const warehouseId = parseOptionalId(req.query.warehouseId);
      const status = parseEnum(TaskStatus, req.query.status, "status");
      const assignedToId = parseOptionalId(req.query.assignedToId);

      const where: Prisma.PutawayTaskWhereInput = {
        ...(warehouseId ? { warehouseId } : {}),
        ...(status
          ? { status }
          : {
              status: {
                in: [
                  TaskStatus.PENDING,
                  TaskStatus.ASSIGNED,
                  TaskStatus.IN_PROGRESS,
                ],
              },
            }),
        ...(assignedToId ? { assignedToId } : {}),
      };

      const [totalItems, tasks] = await Promise.all([
        prisma.putawayTask.count({ where }),
        prisma.putawayTask.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
          include: {
            product: {
              select: {
                id: true,
                code: true,
                name: true,
                uom: { select: { code: true } },
              },
            },
            lot: {
              select: {
                id: true,
                lotNumber: true,
                batchNumber: true,
                expiryDate: true,
              },
            },
            fromBin: { select: { id: true, code: true } },
            toBin: {
              select: {
                id: true,
                code: true,
                aisle: true,
                rack: true,
                level: true,
              },
            },
            warehouse: { select: { id: true, code: true } },
            assignedTo: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        }),
      ]);

      return res.json({
        data: tasks,
        pagination: paginationMeta(totalItems, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** GET /api/wms/putaway-suggestions */
  async putawaySuggestions(req: Request, res: Response) {
    const operation = "Suggest putaway bins";
    try {
      const suggestions = await suggestPutawayBins({
        productId: parseId(String(req.query.productId), "productId"),
        warehouseId: parseId(String(req.query.warehouseId), "warehouseId"),
        quantity: String(req.query.quantity ?? "1"),
        limit: parseOptionalId(req.query.limit) ?? 5,
      });
      return res.json({ data: suggestions });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** PATCH /api/wms/putaway-tasks/:id/assign */
  async assignPutawayTask(req: Request, res: Response) {
    const operation = "Assign putaway task";
    try {
      const id = parseId(req.params.id, "Task id");
      const assignedToId = parseId(
        String(req.body.assignedToId),
        "assignedToId"
      );

      const task = await prisma.putawayTask.update({
        where: { id },
        data: { assignedToId, status: TaskStatus.ASSIGNED },
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return res.json({ data: task });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** POST /api/wms/putaway-tasks/:id/complete */
  async completePutaway(req: Request, res: Response) {
    const operation = "Complete putaway task";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "Task id");

      const task = await prisma.$transaction(tx =>
        completePutawayTask(tx, {
          taskId: id,
          toBinId: parseOptionalId(req.body.toBinId),
          quantity: req.body.quantity,
          userId,
        })
      );

      return res.json({ data: task });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  // -------------------------------------------------------------- picking

  /** GET /api/wms/pick-lists */
  async listPickLists(req: Request, res: Response) {
    const operation = "List pick lists";
    try {
      const pagination = parsePagination(req, 25);
      const warehouseId = parseOptionalId(req.query.warehouseId);
      const status = parseEnum(PickListStatus, req.query.status, "status");

      const where: Prisma.PickListWhereInput = {
        ...(warehouseId ? { warehouseId } : {}),
        ...(status ? { status } : {}),
      };

      const [totalItems, pickLists] = await Promise.all([
        prisma.pickList.count({ where }),
        prisma.pickList.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { createdAt: "desc" },
          include: {
            warehouse: { select: { id: true, code: true, name: true } },
            assignedTo: {
              select: { id: true, firstName: true, lastName: true },
            },
            _count: { select: { tasks: true, packages: true } },
          },
        }),
      ]);

      return res.json({
        data: pickLists,
        pagination: paginationMeta(totalItems, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** GET /api/wms/pick-lists/:id */
  async getPickList(req: Request, res: Response) {
    const operation = "Get pick list";
    try {
      const id = parseId(req.params.id, "Pick list id");
      const pickList = await prisma.pickList.findUnique({
        where: { id },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          releasedBy: { select: { id: true, firstName: true, lastName: true } },
          tasks: {
            orderBy: { sequence: "asc" },
            include: {
              product: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  uom: { select: { code: true } },
                },
              },
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
              pickedBy: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
          packages: {
            include: {
              lines: {
                include: {
                  product: { select: { id: true, code: true, name: true } },
                  lot: { select: { id: true, lotNumber: true } },
                },
              },
              pallet: { select: { id: true, code: true } },
            },
          },
        },
      });
      if (!pickList) throw new NotFoundError("Pick list");
      return res.json({ data: pickList });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /**
   * POST /api/wms/pick-lists
   * Build a pick list. Pass `salesOrderId` to pull the lines straight off a
   * sales order, or `lines` to pick ad hoc.
   */
  async createPickList(req: Request, res: Response) {
    const operation = "Create pick list";
    try {
      const userId = requireUserId(req);
      const salesOrderId = parseOptionalId(req.body.salesOrderId);

      let lines: Array<{ productId: number; quantity: string | number }>;
      let referenceType: string;
      let referenceId: number;
      let referenceNumber: string | null;

      if (salesOrderId) {
        const salesOrder = await prisma.salesOrder.findUnique({
          where: { id: salesOrderId },
          include: { lineItems: true },
        });
        if (!salesOrder) throw new NotFoundError("Sales order");

        lines = salesOrder.lineItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        }));
        referenceType = "SALES_ORDER";
        referenceId = salesOrder.id;
        referenceNumber = salesOrder.orderNumber;
      } else {
        const requested = requireArray<{
          productId: number;
          quantity: string | number;
        }>(req.body.lines, "lines");
        lines = requested.map((line, index) => ({
          productId: parseId(
            String(line.productId),
            `lines[${index}].productId`
          ),
          quantity: line.quantity,
        }));
        referenceType = optionalString(req.body.referenceType) ?? "MANUAL";
        referenceId = parseOptionalId(req.body.referenceId) ?? 0;
        referenceNumber = optionalString(req.body.referenceNumber);
      }

      const pickList = await prisma.$transaction(tx =>
        createPickList(tx, {
          warehouseId: parseId(String(req.body.warehouseId), "warehouseId"),
          referenceType,
          referenceId,
          referenceNumber,
          lines,
          strategy:
            parseEnum(PickingStrategy, req.body.strategy, "strategy") ?? null,
          assignedToId: parseOptionalId(req.body.assignedToId),
          notes: optionalString(req.body.notes),
          createdById: userId,
        })
      );

      return res.status(201).json({ data: pickList });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** PATCH /api/wms/pick-lists/:id/release */
  async releasePickList(req: Request, res: Response) {
    const operation = "Release pick list";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "Pick list id");
      const pickList = await prisma.$transaction(tx =>
        releasePickList(tx, id, userId)
      );
      return res.json({ data: pickList });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** PATCH /api/wms/pick-lists/:id/cancel */
  async cancelPickList(req: Request, res: Response) {
    const operation = "Cancel pick list";
    try {
      const id = parseId(req.params.id, "Pick list id");
      const pickList = await prisma.$transaction(tx => cancelPickList(tx, id));
      return res.json({ data: pickList });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** POST /api/wms/pick-tasks/:id/confirm */
  async confirmPick(req: Request, res: Response) {
    const operation = "Confirm pick";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "Pick task id");

      const task = await prisma.$transaction(tx =>
        confirmPick(tx, {
          pickTaskId: id,
          quantity: req.body.quantity,
          userId,
          notes: optionalString(req.body.notes),
        })
      );

      return res.json({ data: task });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  // -------------------------------------------------------------- packing

  /** POST /api/wms/pick-lists/:id/packages */
  async createPackage(req: Request, res: Response) {
    const operation = "Pack goods";
    try {
      const userId = requireUserId(req);
      const pickListId = parseId(req.params.id, "Pick list id");
      const lines = requireArray<{
        pickTaskId: number;
        quantity: string | number;
      }>(req.body.lines, "lines");

      const created = await prisma.$transaction(tx =>
        packPickedGoods(tx, {
          pickListId,
          lines: lines.map((line, index) => ({
            pickTaskId: parseId(
              String(line.pickTaskId),
              `lines[${index}].pickTaskId`
            ),
            quantity: line.quantity,
          })),
          palletId: parseOptionalId(req.body.palletId),
          grossWeightKg: req.body.grossWeightKg ?? null,
          lengthCm: req.body.lengthCm ?? null,
          widthCm: req.body.widthCm ?? null,
          heightCm: req.body.heightCm ?? null,
          carrier: optionalString(req.body.carrier),
          trackingNumber: optionalString(req.body.trackingNumber),
          userId,
        })
      );

      return res.status(201).json({ data: created });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** POST /api/wms/pick-lists/:id/ship */
  async ship(req: Request, res: Response) {
    const operation = "Ship packages";
    try {
      const pickListId = parseId(req.params.id, "Pick list id");
      const packageIds = requireArray<number>(
        req.body.packageIds,
        "packageIds"
      ).map(value => Number(value));

      const remaining = await prisma.$transaction(tx =>
        shipPackages(tx, { packageIds, pickListId })
      );
      return res.json({
        data: { shipped: packageIds.length, remainingOpenPackages: remaining },
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** GET /api/wms/packages */
  async listPackages(req: Request, res: Response) {
    const operation = "List packages";
    try {
      const pagination = parsePagination(req, 25);
      const status = parseEnum(PackageStatus, req.query.status, "status");
      const pickListId = parseOptionalId(req.query.pickListId);

      const where: Prisma.PackageWhereInput = {
        ...(status ? { status } : {}),
        ...(pickListId ? { pickListId } : {}),
      };

      const [totalItems, packages] = await Promise.all([
        prisma.package.count({ where }),
        prisma.package.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { createdAt: "desc" },
          include: {
            pickList: {
              select: {
                id: true,
                pickListNumber: true,
                referenceNumber: true,
                referenceType: true,
              },
            },
            pallet: { select: { id: true, code: true } },
            packedBy: { select: { id: true, firstName: true, lastName: true } },
            _count: { select: { lines: true } },
          },
        }),
      ]);

      return res.json({
        data: packages,
        pagination: paginationMeta(totalItems, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /**
   * GET /api/wms/dashboard
   * The floor's workload at a glance.
   */
  async dashboard(req: Request, res: Response) {
    const operation = "WMS dashboard";
    try {
      const warehouseId = parseOptionalId(req.query.warehouseId);

      const [
        openPutaway,
        openPickLists,
        pickTasksPending,
        packagesOpen,
        binCount,
        occupiedBins,
        palletsInUse,
      ] = await Promise.all([
        prisma.putawayTask.count({
          where: {
            ...(warehouseId ? { warehouseId } : {}),
            status: {
              in: [
                TaskStatus.PENDING,
                TaskStatus.ASSIGNED,
                TaskStatus.IN_PROGRESS,
              ],
            },
          },
        }),
        prisma.pickList.count({
          where: {
            ...(warehouseId ? { warehouseId } : {}),
            status: {
              in: [
                PickListStatus.DRAFT,
                PickListStatus.RELEASED,
                PickListStatus.IN_PROGRESS,
              ],
            },
          },
        }),
        prisma.pickTask.count({
          where: {
            status: {
              in: [
                TaskStatus.PENDING,
                TaskStatus.ASSIGNED,
                TaskStatus.IN_PROGRESS,
              ],
            },
            ...(warehouseId ? { pickList: { warehouseId } } : {}),
          },
        }),
        prisma.package.count({
          where: {
            status: PackageStatus.PACKED,
            ...(warehouseId ? { pickList: { warehouseId } } : {}),
          },
        }),
        prisma.storageBin.count({
          where: { isActive: true, ...(warehouseId ? { warehouseId } : {}) },
        }),
        prisma.storageBin.count({
          where: {
            isActive: true,
            ...(warehouseId ? { warehouseId } : {}),
            stockBalances: { some: { quantity: { gt: 0 } } },
          },
        }),
        prisma.pallet.count({
          where: {
            status: { in: ["IN_USE", "STAGED"] },
            ...(warehouseId ? { warehouseId } : {}),
          },
        }),
      ]);

      return res.json({
        data: {
          openPutawayTasks: openPutaway,
          openPickLists,
          pendingPickTasks: pickTasksPending,
          packagesAwaitingDispatch: packagesOpen,
          totalBins: binCount,
          occupiedBins,
          emptyBins: binCount - occupiedBins,
          binOccupancyPercent:
            binCount === 0
              ? 0
              : Math.round((occupiedBins / binCount) * 10000) / 100,
          palletsInUse,
        },
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }
}
