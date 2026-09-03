import { Request, Response } from "express";
import { prisma } from "@repo/db";
import {
  Prisma,
  AlertSeverity,
  AlertStatus,
  ItemType,
  MovementDirection,
  StockAlertType,
  StockCountStatus,
  StockCountType,
  StockMovementType,
  StockStatus,
} from "@prisma/client";
import {
  adjustStock,
  getAvailability,
  getIncomingQuantity,
  moveStock,
  receiveStock,
} from "../services/supplyChain/stock.service.js";
import {
  acknowledgeAlert,
  evaluateStockAlerts,
  resolveAlert,
} from "../services/supplyChain/reorder.service.js";
import {
  nextDocumentNumber,
  SEQUENCE_KEYS,
} from "../services/supplyChain/numbering.service.js";
import { DomainError, NotFoundError } from "../services/supplyChain/errors.js";
import {
  ZERO,
  requireNonNegative,
  roundCost,
  roundQuantity,
} from "../services/supplyChain/decimal.js";
import {
  handleSupplyChainError,
  optionalString,
  paginationMeta,
  parseBoolean,
  parseDate,
  parseDateRange,
  parseEnum,
  parseEnumList,
  parseId,
  parseOptionalInteger,
  parseOptionalId,
  parsePagination,
  requireArray,
  requireString,
  requireUserId,
} from "../utils/supply-chain-http.js";

export class InventoryController {
  async listStock(req: Request, res: Response) {
    const operation = "List stock positions";
    try {
      const pagination = parsePagination(req, 25);
      const warehouseId = parseOptionalId(req.query.warehouseId);
      const search = optionalString(req.query.search);
      const itemTypes = parseEnumList(ItemType, req.query.itemType, "itemType");
      const onlyBelowReorder = parseBoolean(req.query.belowReorder);

      const productWhere: Prisma.ProductWhereInput = {
        isStockTracked: true,
        ...(itemTypes.length > 0 ? { itemType: { in: itemTypes } } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
                { barcode: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [totalItems, products] = await Promise.all([
        prisma.product.count({ where: productWhere }),
        prisma.product.findMany({
          where: productWhere,
          skip: onlyBelowReorder ? undefined : pagination.skip,
          take: onlyBelowReorder ? undefined : pagination.limit,
          orderBy: { code: "asc" },
          select: {
            id: true,
            code: true,
            name: true,
            imageUrl: true,
            itemType: true,
            trackingType: true,
            pickingStrategy: true,
            standardCost: true,
            uom: { select: { id: true, code: true, name: true } },
            category: { select: { id: true, name: true } },
          },
        }),
      ]);

      const productIds = products.map(product => product.id);
      const availability = await getAvailability(productIds, warehouseId);
      const incoming = await getIncomingQuantity(productIds, warehouseId);

      const rules = await prisma.reorderRule.findMany({
        where: {
          productId: { in: productIds },
          ...(warehouseId ? { warehouseId } : {}),
          isActive: true,
        },
        select: {
          productId: true,
          safetyStock: true,
          reorderPoint: true,
          reorderQuantity: true,
          maximumStock: true,
        },
      });
      const ruleByProduct = new Map(rules.map(rule => [rule.productId, rule]));

      let rows = products.map(product => {
        const position = availability.get(`${product.id}:${warehouseId ?? 0}`);
        const onHand = position?.onHand ?? ZERO;
        const reserved = position?.reserved ?? ZERO;
        const available = position?.available ?? ZERO;
        const rule = ruleByProduct.get(product.id) ?? null;

        return {
          product,
          warehouseId: warehouseId ?? null,
          onHandQuantity: onHand,
          reservedQuantity: reserved,
          availableQuantity: available,
          incomingQuantity: incoming.get(product.id) ?? ZERO,
          stockValue: roundCost(position?.value ?? ZERO),
          averageUnitCost: onHand.isZero()
            ? ZERO
            : roundCost((position?.value ?? ZERO).dividedBy(onHand)),
          safetyStock: rule?.safetyStock ?? null,
          reorderPoint: rule?.reorderPoint ?? null,
          reorderQuantity: rule?.reorderQuantity ?? null,
          maximumStock: rule?.maximumStock ?? null,
          isBelowReorderPoint: rule
            ? available.lessThanOrEqualTo(rule.reorderPoint)
            : false,
          isBelowSafetyStock: rule
            ? available.lessThan(rule.safetyStock)
            : false,
          isStockedOut: available.lessThanOrEqualTo(0),
        };
      });

      let effectiveTotal = totalItems;
      if (onlyBelowReorder) {
        rows = rows.filter(row => row.isBelowReorderPoint || row.isStockedOut);
        effectiveTotal = rows.length;
        rows = rows.slice(pagination.skip, pagination.skip + pagination.limit);
      }

      return res.json({
        data: rows,
        pagination: paginationMeta(effectiveTotal, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async getProductStock(req: Request, res: Response) {
    const operation = "Get product stock detail";
    try {
      const productId = parseId(req.params.productId, "Product id");
      const warehouseId = parseOptionalId(req.query.warehouseId);

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          code: true,
          name: true,
          itemType: true,
          trackingType: true,
          pickingStrategy: true,
          valuationMethod: true,
          shelfLifeDays: true,
          standardCost: true,
          uom: { select: { id: true, code: true, name: true } },
        },
      });
      if (!product) throw new NotFoundError("Product");

      const balances = await prisma.stockBalance.findMany({
        where: {
          productId,
          ...(warehouseId ? { warehouseId } : {}),
          quantity: { not: 0 },
        },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          bin: {
            select: {
              id: true,
              code: true,
              aisle: true,
              rack: true,
              level: true,
              zone: { select: { id: true, code: true, name: true } },
            },
          },
          lot: {
            select: {
              id: true,
              lotNumber: true,
              batchNumber: true,
              serialNumber: true,
              expiryDate: true,
              manufacturedDate: true,
              receivedAt: true,
              unitCost: true,
              status: true,
              supplier: { select: { id: true, code: true, name: true } },
            },
          },
          pallet: { select: { id: true, code: true } },
        },
        orderBy: [{ warehouseId: "asc" }, { binId: "asc" }],
      });

      const byWarehouse = new Map<
        number,
        {
          warehouse: { id: number; code: string; name: string };
          onHand: Prisma.Decimal;
          reserved: Prisma.Decimal;
          value: Prisma.Decimal;
        }
      >();

      for (const balance of balances) {
        const entry = byWarehouse.get(balance.warehouseId) ?? {
          warehouse: balance.warehouse,
          onHand: ZERO,
          reserved: ZERO,
          value: ZERO,
        };
        entry.onHand = entry.onHand.plus(balance.quantity);
        entry.reserved = entry.reserved.plus(balance.reservedQuantity);
        entry.value = entry.value.plus(
          balance.quantity.times(balance.lot.unitCost)
        );
        byWarehouse.set(balance.warehouseId, entry);
      }

      const reservations = await prisma.stockReservation.findMany({
        where: {
          productId,
          ...(warehouseId ? { warehouseId } : {}),
          status: "ACTIVE",
        },
        include: { warehouse: { select: { id: true, code: true } } },
        orderBy: { createdAt: "desc" },
      });

      return res.json({
        data: {
          product,
          totals: [...byWarehouse.values()].map(entry => ({
            warehouse: entry.warehouse,
            onHandQuantity: entry.onHand,
            reservedQuantity: entry.reserved,
            availableQuantity: entry.onHand.minus(entry.reserved),
            stockValue: roundCost(entry.value),
          })),
          locations: balances,
          reservations,
        },
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async listMovements(req: Request, res: Response) {
    const operation = "List stock movements";
    try {
      const pagination = parsePagination(req, 50);
      const productId = parseOptionalId(req.query.productId);
      const warehouseId = parseOptionalId(req.query.warehouseId);
      const lotId = parseOptionalId(req.query.lotId);
      const movementTypes = parseEnumList(
        StockMovementType,
        req.query.movementType,
        "movementType"
      );
      const direction = parseEnum(
        MovementDirection,
        req.query.direction,
        "direction"
      );
      const referenceType = optionalString(req.query.referenceType);
      const { from, to } = parseDateRange(req, 90);

      const where: Prisma.StockMovementWhereInput = {
        occurredAt: { gte: from, lte: to },
        ...(productId ? { productId } : {}),
        ...(lotId ? { lotId } : {}),
        ...(movementTypes.length > 0
          ? { movementType: { in: movementTypes } }
          : {}),
        ...(direction ? { direction } : {}),
        ...(referenceType ? { referenceType } : {}),
        ...(warehouseId
          ? {
              OR: [
                { fromWarehouseId: warehouseId },
                { toWarehouseId: warehouseId },
              ],
            }
          : {}),
      };

      const [totalItems, movements] = await Promise.all([
        prisma.stockMovement.count({ where }),
        prisma.stockMovement.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
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
            uom: { select: { code: true } },
            fromWarehouse: { select: { id: true, code: true } },
            toWarehouse: { select: { id: true, code: true } },
            fromBin: { select: { id: true, code: true } },
            toBin: { select: { id: true, code: true } },
            performedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        }),
      ]);

      return res.json({
        data: movements,
        pagination: paginationMeta(totalItems, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async listLots(req: Request, res: Response) {
    const operation = "List stock lots";
    try {
      const pagination = parsePagination(req, 50);
      const productId = parseOptionalId(req.query.productId);
      const search = optionalString(req.query.search);
      const expiringWithinDays = parseOptionalId(req.query.expiringWithinDays);
      const onlyInStock = parseBoolean(req.query.onlyInStock) ?? true;

      let expiryFilter: Prisma.StockLotWhereInput = {};
      if (expiringWithinDays !== null) {
        const horizon = new Date();
        horizon.setUTCDate(horizon.getUTCDate() + expiringWithinDays);
        expiryFilter = { expiryDate: { not: null, lte: horizon } };
      }

      const where: Prisma.StockLotWhereInput = {
        ...(productId ? { productId } : {}),
        ...(onlyInStock ? { remainingQuantity: { gt: 0 } } : {}),
        ...expiryFilter,
        ...(search
          ? {
              OR: [
                { lotNumber: { contains: search, mode: "insensitive" } },
                { batchNumber: { contains: search, mode: "insensitive" } },
                { serialNumber: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [totalItems, lots] = await Promise.all([
        prisma.stockLot.count({ where }),
        prisma.stockLot.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
          include: {
            product: {
              select: { id: true, code: true, name: true, trackingType: true },
            },
            originWarehouse: { select: { id: true, code: true } },
            supplier: { select: { id: true, code: true, name: true } },
            balances: {
              where: { quantity: { gt: 0 } },
              select: {
                quantity: true,
                warehouse: { select: { id: true, code: true } },
                bin: { select: { id: true, code: true } },
              },
            },
          },
        }),
      ]);

      return res.json({
        data: lots,
        pagination: paginationMeta(totalItems, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async createReceipt(req: Request, res: Response) {
    const operation = "Receive stock";
    try {
      const userId = requireUserId(req);
      const movementType =
        parseEnum(StockMovementType, req.body.movementType, "movementType") ??
        StockMovementType.OPENING_BALANCE;

      const allowed: StockMovementType[] = [
        StockMovementType.OPENING_BALANCE,
        StockMovementType.SALES_RETURN,
        StockMovementType.PRODUCTION_RECEIPT,
        StockMovementType.ADJUSTMENT_IN,
      ];
      if (!allowed.includes(movementType)) {
        throw new DomainError(
          `movementType must be one of: ${allowed.join(", ")}. Purchase receipts are posted through a goods receipt note.`,
          { code: "MOVEMENT_TYPE_NOT_ALLOWED" }
        );
      }

      const result = await prisma.$transaction(tx =>
        receiveStock(tx, {
          productId: parseId(String(req.body.productId), "productId"),
          warehouseId: parseId(String(req.body.warehouseId), "warehouseId"),
          binId: parseOptionalId(req.body.binId),
          palletId: parseOptionalId(req.body.palletId),
          quantity: req.body.quantity,
          unitCost: req.body.unitCost,
          movementType,
          lot: {
            batchNumber: optionalString(req.body.batchNumber),
            serialNumber: optionalString(req.body.serialNumber),
            manufacturedDate: parseDate(
              req.body.manufacturedDate,
              "manufacturedDate"
            ),
            expiryDate: parseDate(req.body.expiryDate, "expiryDate"),
            supplierId: parseOptionalId(req.body.supplierId),
          },
          reference: {
            type: optionalString(req.body.referenceType) ?? "MANUAL_RECEIPT",
            number: optionalString(req.body.referenceNumber),
          },
          reasonCode: optionalString(req.body.reasonCode),
          notes: optionalString(req.body.notes),
          performedById: userId,
        })
      );

      return res.status(201).json({ data: result });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async createAdjustment(req: Request, res: Response) {
    const operation = "Adjust stock";
    try {
      const userId = requireUserId(req);

      const result = await prisma.$transaction(tx =>
        adjustStock(tx, {
          productId: parseId(String(req.body.productId), "productId"),
          warehouseId: parseId(String(req.body.warehouseId), "warehouseId"),
          binId: parseId(String(req.body.binId), "binId"),
          lotId: parseOptionalId(req.body.lotId),
          deltaQuantity: req.body.deltaQuantity,
          unitCost: req.body.unitCost ?? null,
          reasonCode: requireString(req.body.reasonCode, "reasonCode"),
          notes: optionalString(req.body.notes),
          performedById: userId,
        })
      );

      return res.status(201).json({ data: result });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async createTransfer(req: Request, res: Response) {
    const operation = "Transfer stock";
    try {
      const userId = requireUserId(req);

      const result = await prisma.$transaction(tx =>
        moveStock(tx, {
          productId: parseId(String(req.body.productId), "productId"),
          lotId: parseId(String(req.body.lotId), "lotId"),
          quantity: req.body.quantity,
          fromWarehouseId: parseId(
            String(req.body.fromWarehouseId),
            "fromWarehouseId"
          ),
          fromBinId: parseId(String(req.body.fromBinId), "fromBinId"),
          toWarehouseId: parseId(
            String(req.body.toWarehouseId),
            "toWarehouseId"
          ),
          toBinId: parseId(String(req.body.toBinId), "toBinId"),
          toPalletId: parseOptionalId(req.body.toPalletId),
          reference: {
            type: "STOCK_TRANSFER",
            number: optionalString(req.body.referenceNumber),
          },
          reasonCode: optionalString(req.body.reasonCode),
          notes: optionalString(req.body.notes),
          performedById: userId,
        })
      );

      return res.status(201).json({ data: result });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async listAlerts(req: Request, res: Response) {
    const operation = "List stock alerts";
    try {
      const pagination = parsePagination(req, 25);
      const status = parseEnum(AlertStatus, req.query.status, "status");
      const severity = parseEnum(AlertSeverity, req.query.severity, "severity");
      const alertType = parseEnum(
        StockAlertType,
        req.query.alertType,
        "alertType"
      );
      const warehouseId = parseOptionalId(req.query.warehouseId);

      const where: Prisma.StockAlertWhereInput = {
        ...(status
          ? { status }
          : { status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] } }),
        ...(severity ? { severity } : {}),
        ...(alertType ? { alertType } : {}),
        ...(warehouseId ? { warehouseId } : {}),
      };

      const [totalItems, alerts, severityCounts] = await Promise.all([
        prisma.stockAlert.count({ where }),
        prisma.stockAlert.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
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
            warehouse: { select: { id: true, code: true, name: true } },
            acknowledgedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        }),
        prisma.stockAlert.groupBy({
          by: ["severity"],
          where: { status: AlertStatus.OPEN },
          _count: { _all: true },
        }),
      ]);

      return res.json({
        data: alerts,
        pagination: paginationMeta(totalItems, pagination),
        summary: Object.fromEntries(
          severityCounts.map(row => [row.severity, row._count._all])
        ),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async evaluateAlerts(req: Request, res: Response) {
    const operation = "Evaluate stock alerts";
    try {
      const summary = await evaluateStockAlerts({
        warehouseId: parseOptionalId(
          req.body.warehouseId ?? req.query.warehouseId
        ),
        notify: parseBoolean(req.body.notify) ?? true,
      });
      return res.json({ data: summary });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async acknowledgeAlert(req: Request, res: Response) {
    const operation = "Acknowledge stock alert";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "Alert id");
      const alert = await acknowledgeAlert(
        id,
        userId,
        optionalString(req.body.note)
      );
      return res.json({ data: alert });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async resolveAlert(req: Request, res: Response) {
    const operation = "Resolve stock alert";
    try {
      const id = parseId(req.params.id, "Alert id");
      const alert = await resolveAlert(id, optionalString(req.body.note));
      return res.json({ data: alert });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async listReorderRules(req: Request, res: Response) {
    const operation = "List reorder rules";
    try {
      const pagination = parsePagination(req, 50);
      const warehouseId = parseOptionalId(req.query.warehouseId);
      const productId = parseOptionalId(req.query.productId);

      const where: Prisma.ReorderRuleWhereInput = {
        ...(warehouseId ? { warehouseId } : {}),
        ...(productId ? { productId } : {}),
      };

      const [totalItems, rules] = await Promise.all([
        prisma.reorderRule.count({ where }),
        prisma.reorderRule.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { id: "desc" },
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
            warehouse: { select: { id: true, code: true, name: true } },
            preferredSupplier: { select: { id: true, code: true, name: true } },
          },
        }),
      ]);

      const availability = await getAvailability(
        rules.map(rule => rule.productId),
        warehouseId
      );

      const data = rules.map(rule => {
        const position = availability.get(
          `${rule.productId}:${warehouseId ?? 0}`
        );
        return {
          ...rule,
          currentAvailable: position?.available ?? ZERO,
          currentOnHand: position?.onHand ?? ZERO,
        };
      });

      return res.json({
        data,
        pagination: paginationMeta(totalItems, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async upsertReorderRule(req: Request, res: Response) {
    const operation = "Save reorder rule";
    try {
      const productId = parseId(String(req.body.productId), "productId");
      const warehouseId = parseId(String(req.body.warehouseId), "warehouseId");

      const safetyStock = requireNonNegative(
        req.body.safetyStock ?? 0,
        "safetyStock"
      );
      const reorderPoint = requireNonNegative(
        req.body.reorderPoint ?? 0,
        "reorderPoint"
      );
      const reorderQuantity = requireNonNegative(
        req.body.reorderQuantity ?? 0,
        "reorderQuantity"
      );
      const maximumStock =
        req.body.maximumStock === undefined ||
        req.body.maximumStock === null ||
        req.body.maximumStock === ""
          ? null
          : requireNonNegative(req.body.maximumStock, "maximumStock");
      const leadTimeDays =
        parseOptionalInteger(req.body.leadTimeDays, "leadTimeDays", 0, 3_650) ??
        0;
      const autoRequisition =
        parseBoolean(req.body.autoRequisition, "autoRequisition") ?? false;
      const isActive = parseBoolean(req.body.isActive, "isActive");

      if (reorderPoint.lessThan(safetyStock)) {
        throw new DomainError(
          "The reorder point must be at or above the safety stock, otherwise the buffer is breached before an order is raised",
          { code: "THRESHOLDS_INCONSISTENT" }
        );
      }
      if (maximumStock && maximumStock.lessThan(reorderPoint)) {
        throw new DomainError(
          "The maximum stock level must be above the reorder point",
          {
            code: "THRESHOLDS_INCONSISTENT",
          }
        );
      }

      const rule = await prisma.reorderRule.upsert({
        where: { productId_warehouseId: { productId, warehouseId } },
        create: {
          productId,
          warehouseId,
          safetyStock,
          reorderPoint,
          reorderQuantity,
          maximumStock,
          leadTimeDays,
          autoRequisition,
          preferredSupplierId: parseOptionalId(req.body.preferredSupplierId),
          isActive: isActive ?? true,
        },
        update: {
          safetyStock,
          reorderPoint,
          reorderQuantity,
          maximumStock,
          leadTimeDays,
          autoRequisition,
          preferredSupplierId: parseOptionalId(req.body.preferredSupplierId),
          ...(isActive !== undefined ? { isActive } : {}),
        },
        include: {
          product: { select: { id: true, code: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
        },
      });

      return res.json({ data: rule });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async deleteReorderRule(req: Request, res: Response) {
    const operation = "Delete reorder rule";
    try {
      const id = parseId(req.params.id, "Rule id");
      await prisma.reorderRule.delete({ where: { id } });
      return res.status(204).send();
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async listCounts(req: Request, res: Response) {
    const operation = "List stock counts";
    try {
      const pagination = parsePagination(req, 25);
      const warehouseId = parseOptionalId(req.query.warehouseId);
      const status = parseEnum(StockCountStatus, req.query.status, "status");

      const where: Prisma.StockCountWhereInput = {
        ...(warehouseId ? { warehouseId } : {}),
        ...(status ? { status } : {}),
      };

      const [totalItems, counts] = await Promise.all([
        prisma.stockCount.count({ where }),
        prisma.stockCount.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { createdAt: "desc" },
          include: {
            warehouse: { select: { id: true, code: true, name: true } },
            countedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
            _count: { select: { lines: true } },
          },
        }),
      ]);

      return res.json({
        data: counts,
        pagination: paginationMeta(totalItems, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async createCount(req: Request, res: Response) {
    const operation = "Create stock count";
    try {
      const userId = requireUserId(req);
      const warehouseId = parseId(String(req.body.warehouseId), "warehouseId");
      const zoneId = parseOptionalId(req.body.zoneId);
      const productIds = Array.isArray(req.body.productIds)
        ? req.body.productIds.map(Number).filter(Boolean)
        : [];

      const count = await prisma.$transaction(async tx => {
        const countNumber = await nextDocumentNumber(
          tx,
          SEQUENCE_KEYS.STOCK_COUNT
        );

        const balances = await tx.stockBalance.findMany({
          where: {
            warehouseId,
            quantity: { gt: 0 },
            ...(zoneId ? { bin: { zoneId } } : {}),
            ...(productIds.length > 0 ? { productId: { in: productIds } } : {}),
          },
          select: { productId: true, binId: true, lotId: true, quantity: true },
        });

        if (balances.length === 0) {
          throw new DomainError(
            "There is no stock in the selected scope to count",
            { code: "NOTHING_TO_COUNT" }
          );
        }

        return tx.stockCount.create({
          data: {
            countNumber,
            warehouseId,
            countType:
              parseEnum(StockCountType, req.body.countType, "countType") ??
              StockCountType.CYCLE,
            status: StockCountStatus.IN_PROGRESS,
            scheduledDate: parseDate(req.body.scheduledDate, "scheduledDate"),
            startedAt: new Date(),
            countedById: userId,
            notes: optionalString(req.body.notes),
            lines: {
              create: balances.map(balance => ({
                productId: balance.productId,
                binId: balance.binId,
                lotId: balance.lotId,
                systemQuantity: balance.quantity,
              })),
            },
          },
          include: { _count: { select: { lines: true } } },
        });
      });

      return res.status(201).json({ data: count });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async getCount(req: Request, res: Response) {
    const operation = "Get stock count";
    try {
      const id = parseId(req.params.id, "Count id");
      const count = await prisma.stockCount.findUnique({
        where: { id },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          countedBy: { select: { id: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
          lines: {
            orderBy: { id: "asc" },
            include: {
              product: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  uom: { select: { code: true } },
                },
              },
              bin: { select: { id: true, code: true } },
              lot: {
                select: {
                  id: true,
                  lotNumber: true,
                  batchNumber: true,
                  unitCost: true,
                },
              },
            },
          },
        },
      });
      if (!count) throw new NotFoundError("Stock count");
      return res.json({ data: count });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async recordCountLines(req: Request, res: Response) {
    const operation = "Record counted quantities";
    try {
      const id = parseId(req.params.id, "Count id");
      const lines = requireArray<{
        lineId: number;
        countedQuantity: string | number;
        reasonCode?: string;
        notes?: string;
      }>(req.body.lines, "lines");

      const updated = await prisma.$transaction(async tx => {
        const count = await tx.stockCount.findUnique({ where: { id } });
        if (!count) throw new NotFoundError("Stock count");
        if (
          count.status === StockCountStatus.COMPLETED ||
          count.status === StockCountStatus.CANCELLED
        ) {
          throw new DomainError(
            `This count is already ${count.status.toLowerCase()}`,
            { code: "COUNT_CLOSED" }
          );
        }

        for (const line of lines) {
          const existing = await tx.stockCountLine.findUnique({
            where: { id: parseId(String(line.lineId), "lineId") },
            include: { lot: { select: { unitCost: true } } },
          });
          if (!existing || existing.stockCountId !== id) {
            throw new NotFoundError(`Count line ${line.lineId}`);
          }

          const countedQuantity = requireNonNegative(
            line.countedQuantity,
            "countedQuantity"
          );
          const variance = roundQuantity(
            countedQuantity.minus(existing.systemQuantity)
          );
          const unitCost = existing.lot?.unitCost ?? ZERO;

          await tx.stockCountLine.update({
            where: { id: existing.id },
            data: {
              countedQuantity,
              varianceQuantity: variance,
              varianceValue: roundCost(variance.times(unitCost)),
              reasonCode:
                line.reasonCode === undefined
                  ? existing.reasonCode
                  : optionalString(line.reasonCode, "reasonCode", 100),
              notes:
                line.notes === undefined
                  ? existing.notes
                  : optionalString(line.notes, "notes"),
            },
          });
        }

        return tx.stockCount.findUniqueOrThrow({
          where: { id },
          include: { _count: { select: { lines: true } } },
        });
      });

      return res.json({ data: updated });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async postCount(req: Request, res: Response) {
    const operation = "Post stock count";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "Count id");
      const reasonCode = optionalString(req.body.reasonCode) ?? "CYCLE_COUNT";

      const result = await prisma.$transaction(async tx => {
        const count = await tx.stockCount.findUnique({
          where: { id },
          include: {
            lines: {
              include: { lot: true, product: { select: { code: true } } },
            },
          },
        });
        if (!count) throw new NotFoundError("Stock count");
        if (count.status === StockCountStatus.COMPLETED) {
          throw new DomainError("This count has already been posted", {
            code: "COUNT_CLOSED",
          });
        }

        const posted: Array<{
          lineId: number;
          productCode: string;
          variance: string;
        }> = [];

        const orderedLines = [...count.lines].sort(
          (a, b) => a.productId - b.productId
        );

        for (const line of orderedLines) {
          if (line.isPosted) continue;
          if (line.countedQuantity === null) continue;
          if (line.varianceQuantity.isZero()) {
            await tx.stockCountLine.update({
              where: { id: line.id },
              data: { isPosted: true },
            });
            continue;
          }

          await adjustStock(tx, {
            productId: line.productId,
            warehouseId: count.warehouseId,
            binId: line.binId,
            lotId: line.lotId,
            deltaQuantity: line.varianceQuantity,
            unitCost: line.lot?.unitCost ?? null,
            reasonCode: line.reasonCode ?? reasonCode,
            notes: `Stock count ${count.countNumber}`,
            performedById: userId,
            movementType: line.varianceQuantity.isPositive()
              ? StockMovementType.CYCLE_COUNT_GAIN
              : StockMovementType.CYCLE_COUNT_LOSS,
          });

          await tx.stockCountLine.update({
            where: { id: line.id },
            data: { isPosted: true },
          });
          posted.push({
            lineId: line.id,
            productCode: line.product.code,
            variance: line.varianceQuantity.toFixed(4),
          });
        }

        await tx.stockCount.update({
          where: { id },
          data: {
            status: StockCountStatus.COMPLETED,
            completedAt: new Date(),
            approvedById: userId,
          },
        });

        return {
          countId: id,
          countNumber: count.countNumber,
          postedLines: posted,
        };
      });

      return res.json({ data: result });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async valuation(req: Request, res: Response) {
    const operation = "Inventory valuation";
    try {
      const warehouseId = parseOptionalId(req.query.warehouseId);
      const itemTypes = parseEnumList(ItemType, req.query.itemType, "itemType");

      const balances = await prisma.stockBalance.findMany({
        where: {
          quantity: { gt: 0 },
          status: StockStatus.AVAILABLE,
          ...(warehouseId ? { warehouseId } : {}),
          ...(itemTypes.length > 0
            ? { product: { itemType: { in: itemTypes } } }
            : {}),
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
          lot: { select: { unitCost: true } },
          warehouse: { select: { id: true, code: true, name: true } },
        },
      });

      const byProduct = new Map<
        number,
        {
          product: {
            id: number;
            code: string;
            name: string;
            itemType: string;
            uom: { code: string } | null;
          };
          quantity: Prisma.Decimal;
          value: Prisma.Decimal;
        }
      >();
      const byWarehouse = new Map<
        number,
        {
          warehouse: { id: number; code: string; name: string };
          value: Prisma.Decimal;
          quantity: Prisma.Decimal;
        }
      >();
      const byItemType = new Map<
        string,
        { itemType: string; value: Prisma.Decimal; quantity: Prisma.Decimal }
      >();

      for (const balance of balances) {
        const lineValue = balance.quantity.times(balance.lot.unitCost);

        const productEntry = byProduct.get(balance.productId) ?? {
          product: balance.product,
          quantity: ZERO,
          value: ZERO,
        };
        productEntry.quantity = productEntry.quantity.plus(balance.quantity);
        productEntry.value = productEntry.value.plus(lineValue);
        byProduct.set(balance.productId, productEntry);

        const warehouseEntry = byWarehouse.get(balance.warehouseId) ?? {
          warehouse: balance.warehouse,
          value: ZERO,
          quantity: ZERO,
        };
        warehouseEntry.value = warehouseEntry.value.plus(lineValue);
        warehouseEntry.quantity = warehouseEntry.quantity.plus(
          balance.quantity
        );
        byWarehouse.set(balance.warehouseId, warehouseEntry);

        const typeEntry = byItemType.get(balance.product.itemType) ?? {
          itemType: balance.product.itemType,
          value: ZERO,
          quantity: ZERO,
        };
        typeEntry.value = typeEntry.value.plus(lineValue);
        typeEntry.quantity = typeEntry.quantity.plus(balance.quantity);
        byItemType.set(balance.product.itemType, typeEntry);
      }

      const products = [...byProduct.values()]
        .map(entry => ({
          product: entry.product,
          quantity: roundQuantity(entry.quantity),
          value: roundCost(entry.value),
          averageUnitCost: entry.quantity.isZero()
            ? ZERO
            : roundCost(entry.value.dividedBy(entry.quantity)),
        }))
        .sort((a, b) => b.value.comparedTo(a.value));

      const totalValue = products.reduce(
        (acc, entry) => acc.plus(entry.value),
        ZERO
      );

      return res.json({
        data: {
          totalValue: roundCost(totalValue),
          distinctItems: products.length,
          byWarehouse: [...byWarehouse.values()].map(entry => ({
            warehouse: entry.warehouse,
            quantity: roundQuantity(entry.quantity),
            value: roundCost(entry.value),
          })),
          byItemType: [...byItemType.values()].map(entry => ({
            itemType: entry.itemType,
            quantity: roundQuantity(entry.quantity),
            value: roundCost(entry.value),
          })),
          products,
        },
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async dashboard(req: Request, res: Response) {
    const operation = "Inventory dashboard";
    try {
      const warehouseId = parseOptionalId(req.query.warehouseId);
      const { from, to } = parseDateRange(req, 30);
      const now = new Date();
      const expiryCutoff = new Date(now.getTime() + 30 * 86_400_000);

      const [
        balances,
        openAlerts,
        alertsBySeverity,
        recentMovements,
        warehouses,
        expiringLots,
      ] = await Promise.all([
        prisma.stockBalance.findMany({
          where: {
            quantity: { gt: 0 },
            ...(warehouseId ? { warehouseId } : {}),
          },
          select: {
            quantity: true,
            reservedQuantity: true,
            productId: true,
            lot: { select: { unitCost: true } },
            product: { select: { itemType: true } },
          },
        }),
        prisma.stockAlert.count({
          where: {
            status: AlertStatus.OPEN,
            ...(warehouseId ? { warehouseId } : {}),
          },
        }),
        prisma.stockAlert.groupBy({
          by: ["severity"],
          where: {
            status: AlertStatus.OPEN,
            ...(warehouseId ? { warehouseId } : {}),
          },
          _count: { _all: true },
        }),
        prisma.stockMovement.findMany({
          where: {
            occurredAt: { gte: from, lte: to },
            ...(warehouseId
              ? {
                  OR: [
                    { fromWarehouseId: warehouseId },
                    { toWarehouseId: warehouseId },
                  ],
                }
              : {}),
          },
          select: {
            movementType: true,
            direction: true,
            quantity: true,
            totalCost: true,
            occurredAt: true,
          },
        }),
        prisma.warehouse.count({
          where: {
            isActive: true,
            ...(warehouseId ? { id: warehouseId } : {}),
          },
        }),
        prisma.stockLot.count({
          where: {
            remainingQuantity: { gt: 0 },
            expiryDate: { gte: now, lte: expiryCutoff },
            ...(warehouseId
              ? { balances: { some: { warehouseId, quantity: { gt: 0 } } } }
              : {}),
          },
        }),
      ]);

      const totalValue = balances.reduce(
        (acc, balance) =>
          acc.plus(balance.quantity.times(balance.lot.unitCost)),
        ZERO
      );
      const totalQuantity = balances.reduce(
        (acc, balance) => acc.plus(balance.quantity),
        ZERO
      );
      const totalReserved = balances.reduce(
        (acc, balance) => acc.plus(balance.reservedQuantity),
        ZERO
      );
      const distinctItems = new Set(balances.map(balance => balance.productId))
        .size;

      const inboundValue = recentMovements
        .filter(movement => movement.direction === MovementDirection.IN)
        .reduce((acc, movement) => acc.plus(movement.totalCost), ZERO);
      const outboundValue = recentMovements
        .filter(movement => movement.direction === MovementDirection.OUT)
        .reduce((acc, movement) => acc.plus(movement.totalCost), ZERO);

      const movementsByType = recentMovements.reduce<
        Record<string, { count: number; quantity: Prisma.Decimal }>
      >((acc, movement) => {
        const entry = acc[movement.movementType] ?? {
          count: 0,
          quantity: ZERO,
        };
        entry.count += 1;
        entry.quantity = entry.quantity.plus(movement.quantity);
        acc[movement.movementType] = entry;
        return acc;
      }, {});

      return res.json({
        data: {
          period: { from, to },
          totalStockValue: roundCost(totalValue),
          totalQuantity: roundQuantity(totalQuantity),
          reservedQuantity: roundQuantity(totalReserved),
          availableQuantity: roundQuantity(totalQuantity.minus(totalReserved)),
          distinctItems,
          activeWarehouses: warehouses,
          openAlerts,
          alertsBySeverity: Object.fromEntries(
            alertsBySeverity.map(row => [row.severity, row._count._all])
          ),
          lotsExpiringSoon: expiringLots,
          inboundValue: roundCost(inboundValue),
          outboundValue: roundCost(outboundValue),
          movementCount: recentMovements.length,
          movementsByType: Object.entries(movementsByType).map(
            ([movementType, entry]) => ({
              movementType,
              count: entry.count,
              quantity: roundQuantity(entry.quantity),
            })
          ),
        },
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async listUnits(_req: Request, res: Response) {
    const operation = "List units of measure";
    try {
      const units = await prisma.unitOfMeasure.findMany({
        where: { isActive: true },
        orderBy: [{ category: "asc" }, { code: "asc" }],
      });
      return res.json({ data: units });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }
}
