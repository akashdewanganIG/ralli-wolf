import { Request, Response } from "express";
import { prisma } from "@repo/db";
import {
  Prisma,
  ProductionOrderStatus,
  ReservationReferenceType,
  StockMovementType,
} from "@prisma/client";
import {
  explodeBom,
  resolveBomForProduct,
} from "../services/supplyChain/bom.service.js";
import {
  checkMaterialAvailability,
  getProductionVariance,
} from "../services/supplyChain/material.service.js";
import {
  receiveStock,
  releaseReservations,
  reserveStock,
} from "../services/supplyChain/stock.service.js";
import {
  nextDocumentNumber,
  SEQUENCE_KEYS,
} from "../services/supplyChain/numbering.service.js";
import { DomainError, NotFoundError } from "../services/supplyChain/errors.js";
import {
  ZERO,
  roundCost,
  roundQuantity,
  toDecimal,
} from "../services/supplyChain/decimal.js";
import {
  handleSupplyChainError,
  optionalString,
  paginationMeta,
  parseBoolean,
  parseDate,
  parseEnum,
  parseId,
  parseOptionalId,
  parsePagination,
  requireUserId,
} from "../utils/supplyChainHttp.js";

const ORDER_INCLUDE = {
  product: {
    select: {
      id: true,
      code: true,
      name: true,
      uom: { select: { code: true } },
    },
  },
  bom: {
    select: {
      id: true,
      bomNumber: true,
      version: true,
      revision: true,
      status: true,
    },
  },
  warehouse: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

export class ProductionController {
  /** GET /api/production-orders */
  async list(req: Request, res: Response) {
    const operation = "List production orders";
    try {
      const pagination = parsePagination(req, 25);
      const status = parseEnum(
        ProductionOrderStatus,
        req.query.status,
        "status"
      );
      const warehouseId = parseOptionalId(req.query.warehouseId);
      const productId = parseOptionalId(req.query.productId);

      const where: Prisma.ProductionOrderWhereInput = {
        ...(status ? { status } : {}),
        ...(warehouseId ? { warehouseId } : {}),
        ...(productId ? { productId } : {}),
      };

      const [totalItems, orders] = await Promise.all([
        prisma.productionOrder.count({ where }),
        prisma.productionOrder.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { createdAt: "desc" },
          include: {
            ...ORDER_INCLUDE,
            _count: { select: { components: true } },
          },
        }),
      ]);

      return res.json({
        data: orders,
        pagination: paginationMeta(totalItems, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** GET /api/production-orders/:id */
  async getById(req: Request, res: Response) {
    const operation = "Get production order";
    try {
      const id = parseId(req.params.id, "Production order id");
      const order = await prisma.productionOrder.findUnique({
        where: { id },
        include: {
          ...ORDER_INCLUDE,
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
          consumption: {
            orderBy: { occurredAt: "desc" },
            include: {
              lot: { select: { id: true, lotNumber: true, batchNumber: true } },
            },
          },
          materialRequisitions: {
            select: {
              id: true,
              requisitionNumber: true,
              status: true,
              issuedAt: true,
            },
          },
        },
      });
      if (!order) throw new NotFoundError("Production order");
      return res.json({ data: order });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /**
   * POST /api/production-orders
   * Plan a build. The BOM is exploded at creation time and the component
   * demand is frozen onto the order, so a later BOM revision cannot silently
   * rewrite what this run was supposed to consume.
   */
  async create(req: Request, res: Response) {
    const operation = "Create production order";
    try {
      const userId = requireUserId(req);
      const productId = parseId(String(req.body.productId), "productId");
      const warehouseId = parseId(String(req.body.warehouseId), "warehouseId");
      const plannedQuantity = toDecimal(
        req.body.plannedQuantity,
        "plannedQuantity"
      );

      if (plannedQuantity.lessThanOrEqualTo(0)) {
        throw new DomainError("plannedQuantity must be greater than zero", {
          code: "VALIDATION_ERROR",
        });
      }

      const bom = await resolveBomForProduct(
        productId,
        parseOptionalId(req.body.bomId)
      );
      if (bom.status !== "ACTIVE") {
        throw new DomainError(
          `BOM ${bom.bomNumber} is ${bom.status.toLowerCase()}; only an active BOM can be used for production`,
          { code: "BOM_NOT_ACTIVE" }
        );
      }

      const exploded = await explodeBom({
        productId,
        bomId: bom.id,
        quantity: plannedQuantity,
        maxLevels: 1,
      });

      const order = await prisma.$transaction(async tx => {
        const orderNumber = await nextDocumentNumber(
          tx,
          SEQUENCE_KEYS.PRODUCTION_ORDER
        );

        const plannedMaterialCost = exploded.components.reduce(
          (acc, component) => acc.plus(component.extendedCost),
          ZERO
        );

        return tx.productionOrder.create({
          data: {
            orderNumber,
            productId,
            bomId: bom.id,
            warehouseId,
            status: ProductionOrderStatus.DRAFT,
            plannedQuantity: roundQuantity(plannedQuantity),
            plannedStartDate: parseDate(
              req.body.plannedStartDate,
              "plannedStartDate"
            ),
            plannedEndDate: parseDate(
              req.body.plannedEndDate,
              "plannedEndDate"
            ),
            plannedMaterialCost: roundCost(plannedMaterialCost),
            notes: optionalString(req.body.notes),
            createdById: userId,
            components: {
              create: exploded.components.map(component => ({
                productId: component.productId,
                requiredQuantity: component.requiredQuantity,
                scrapPercent: component.scrapPercent,
                standardUnitCost: component.unitCost,
              })),
            },
          },
          include: ORDER_INCLUDE,
        });
      });

      return res.status(201).json({ data: order });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** GET /api/production-orders/:id/availability */
  async availability(req: Request, res: Response) {
    const operation = "Check production material availability";
    try {
      const id = parseId(req.params.id, "Production order id");
      const order = await prisma.productionOrder.findUnique({ where: { id } });
      if (!order) throw new NotFoundError("Production order");

      const result = await checkMaterialAvailability({
        productId: order.productId,
        bomId: order.bomId,
        quantity: order.plannedQuantity,
        warehouseId: order.warehouseId,
        includeSubstitutes: true,
      });

      return res.json({ data: result });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /**
   * POST /api/production-orders/:id/release
   * Release the order to the floor and reserve its components, so the build
   * cannot have its materials picked away by another order.
   */
  async release(req: Request, res: Response) {
    const operation = "Release production order";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "Production order id");
      const reserveMaterials = parseBoolean(req.body.reserveMaterials) ?? true;

      const order = await prisma.$transaction(
        async tx => {
          const existing = await tx.productionOrder.findUnique({
            where: { id },
            include: {
              components: { include: { product: { select: { code: true } } } },
            },
          });
          if (!existing) throw new NotFoundError("Production order");
          if (
            existing.status !== ProductionOrderStatus.DRAFT &&
            existing.status !== ProductionOrderStatus.PLANNED
          ) {
            throw new DomainError(
              `Only a draft or planned order can be released; this one is ${existing.status.toLowerCase()}`,
              { code: "INVALID_STATUS" }
            );
          }

          if (reserveMaterials) {
            // Ascending product order keeps the stock locks deterministic.
            const ordered = [...existing.components].sort(
              (a, b) => a.productId - b.productId
            );
            for (const component of ordered) {
              const outstanding = component.requiredQuantity.minus(
                component.issuedQuantity
              );
              if (outstanding.lessThanOrEqualTo(0)) continue;
              await reserveStock(tx, {
                productId: component.productId,
                warehouseId: existing.warehouseId,
                quantity: outstanding,
                referenceType: ReservationReferenceType.PRODUCTION_ORDER,
                referenceId: existing.id,
                referenceNumber: existing.orderNumber,
                createdById: userId,
              });
            }
          }

          return tx.productionOrder.update({
            where: { id },
            data: {
              status: ProductionOrderStatus.RELEASED,
              actualStartDate: new Date(),
            },
            include: ORDER_INCLUDE,
          });
        },
        { timeout: 60_000, maxWait: 10_000 }
      );

      return res.json({ data: order });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /**
   * POST /api/production-orders/:id/complete
   * Book finished goods in. The unit cost is the material actually consumed
   * plus the BOM's labour and overhead, spread over the good units produced —
   * so what lands in stock is what the run really cost.
   */
  async complete(req: Request, res: Response) {
    const operation = "Complete production order";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "Production order id");
      const producedQuantity = toDecimal(
        req.body.producedQuantity,
        "producedQuantity"
      );
      const scrappedQuantity = req.body.scrappedQuantity
        ? toDecimal(req.body.scrappedQuantity, "scrappedQuantity")
        : ZERO;

      if (producedQuantity.lessThanOrEqualTo(0)) {
        throw new DomainError("producedQuantity must be greater than zero", {
          code: "VALIDATION_ERROR",
        });
      }

      const result = await prisma.$transaction(
        async tx => {
          const order = await tx.productionOrder.findUnique({
            where: { id },
            include: {
              bom: true,
              product: { select: { code: true, trackingType: true } },
            },
          });
          if (!order) throw new NotFoundError("Production order");
          if (
            order.status !== ProductionOrderStatus.RELEASED &&
            order.status !== ProductionOrderStatus.IN_PROGRESS
          ) {
            throw new DomainError(
              `Only a released or in-progress order can be completed; this one is ${order.status.toLowerCase()}`,
              { code: "INVALID_STATUS" }
            );
          }

          const totalOutput = producedQuantity.plus(scrappedQuantity);
          const remaining = order.plannedQuantity
            .minus(order.producedQuantity)
            .minus(order.scrappedQuantity);
          if (totalOutput.greaterThan(remaining)) {
            throw new DomainError(
              `Only ${remaining.toFixed(4)} unit(s) of ${order.plannedQuantity.toFixed(4)} planned are still outstanding on ${order.orderNumber}`,
              { code: "QUANTITY_EXCEEDS_PLAN" }
            );
          }

          // Cost the output from what the run actually consumed.
          const unitCost = producedQuantity.isZero()
            ? ZERO
            : roundCost(
                order.actualMaterialCost
                  .plus(order.bom.laborCost.times(producedQuantity))
                  .plus(order.bom.overheadCost.times(producedQuantity))
                  .dividedBy(producedQuantity)
              );

          const received = await receiveStock(tx, {
            productId: order.productId,
            warehouseId: order.warehouseId,
            binId: parseOptionalId(req.body.binId),
            quantity: producedQuantity,
            unitCost,
            movementType: StockMovementType.PRODUCTION_RECEIPT,
            lot: {
              batchNumber:
                optionalString(req.body.batchNumber) ?? order.orderNumber,
              serialNumber: optionalString(req.body.serialNumber),
              manufacturedDate: new Date(),
              expiryDate: parseDate(req.body.expiryDate, "expiryDate"),
            },
            reference: {
              type: "PRODUCTION_ORDER",
              id: order.id,
              number: order.orderNumber,
            },
            performedById: userId,
          });

          const newProduced = roundQuantity(
            order.producedQuantity.plus(producedQuantity)
          );
          const newScrapped = roundQuantity(
            order.scrappedQuantity.plus(scrappedQuantity)
          );
          const fullyBuilt = newProduced
            .plus(newScrapped)
            .greaterThanOrEqualTo(order.plannedQuantity);

          if (fullyBuilt) {
            await releaseReservations(tx, {
              referenceType: ReservationReferenceType.PRODUCTION_ORDER,
              referenceId: order.id,
            });
          }

          const updated = await tx.productionOrder.update({
            where: { id },
            data: {
              producedQuantity: newProduced,
              scrappedQuantity: newScrapped,
              status: fullyBuilt
                ? ProductionOrderStatus.COMPLETED
                : ProductionOrderStatus.IN_PROGRESS,
              actualEndDate: fullyBuilt ? new Date() : null,
            },
            include: ORDER_INCLUDE,
          });

          return { order: updated, receipt: received, unitCost };
        },
        { timeout: 60_000, maxWait: 10_000 }
      );

      return res.json({ data: result });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** PATCH /api/production-orders/:id/cancel */
  async cancel(req: Request, res: Response) {
    const operation = "Cancel production order";
    try {
      const id = parseId(req.params.id, "Production order id");

      const order = await prisma.$transaction(async tx => {
        const existing = await tx.productionOrder.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError("Production order");
        if (existing.producedQuantity.greaterThan(0)) {
          throw new DomainError(
            "Finished goods have already been booked against this order; close it instead of cancelling",
            { status: 409, code: "ALREADY_PRODUCED" }
          );
        }

        await releaseReservations(tx, {
          referenceType: ReservationReferenceType.PRODUCTION_ORDER,
          referenceId: id,
        });

        return tx.productionOrder.update({
          where: { id },
          data: {
            status: ProductionOrderStatus.CANCELLED,
            notes: optionalString(req.body.reason) ?? existing.notes,
          },
          include: ORDER_INCLUDE,
        });
      });

      return res.json({ data: order });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** GET /api/production-orders/:id/variance */
  async variance(req: Request, res: Response) {
    const operation = "Production variance";
    try {
      const id = parseId(req.params.id, "Production order id");
      const data = await getProductionVariance(id);
      return res.json({ data });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }
}
