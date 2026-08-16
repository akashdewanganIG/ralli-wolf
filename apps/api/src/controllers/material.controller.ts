import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { Prisma, ItemType, MaterialRequisitionStatus } from "@prisma/client";
import {
  MATERIAL_ITEM_TYPES,
  checkMaterialAvailability,
  getConsumptionReport,
  issueMaterial,
} from "../services/supplyChain/material.service.js";
import {
  getAvailability,
  getAvailabilityByWarehouse,
  getIncomingQuantity,
  getIncomingQuantityByWarehouse,
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
  parseDate,
  parseDateRange,
  parseEnum,
  parseEnumList,
  parseId,
  parseOptionalId,
  parsePagination,
  requireArray,
  requireUserId,
} from "../utils/supplyChainHttp.js";

export class MaterialController {
  /**
   * GET /api/materials
   * The material master: raw materials, components, consumables and packaging,
   * each with its live position and safety-stock status.
   */
  async list(req: Request, res: Response) {
    const operation = "List materials";
    try {
      const pagination = parsePagination(req, 25);
      const warehouseId = parseOptionalId(req.query.warehouseId);
      const search = optionalString(req.query.search);
      const itemTypes = parseEnumList(ItemType, req.query.itemType, "itemType");

      const where: Prisma.ProductWhereInput = {
        itemType: {
          in: itemTypes.length > 0 ? itemTypes : MATERIAL_ITEM_TYPES,
        },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [totalItems, materials] = await Promise.all([
        prisma.product.count({ where }),
        prisma.product.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { code: "asc" },
          select: {
            id: true,
            code: true,
            name: true,
            itemType: true,
            trackingType: true,
            standardCost: true,
            shelfLifeDays: true,
            isPurchasable: true,
            uom: { select: { id: true, code: true, name: true } },
            category: { select: { id: true, name: true } },
          },
        }),
      ]);

      const productIds = materials.map(material => material.id);
      const [availability, incoming, rules] = await Promise.all([
        getAvailability(productIds, warehouseId),
        getIncomingQuantity(productIds, warehouseId),
        prisma.reorderRule.findMany({
          where: {
            productId: { in: productIds },
            ...(warehouseId ? { warehouseId } : {}),
            isActive: true,
          },
          select: { productId: true, safetyStock: true, reorderPoint: true },
        }),
      ]);
      const ruleByProduct = rules.reduce((map, rule) => {
        const current = map.get(rule.productId) ?? {
          safetyStock: ZERO,
          reorderPoint: ZERO,
        };
        current.safetyStock = current.safetyStock.plus(rule.safetyStock);
        current.reorderPoint = current.reorderPoint.plus(rule.reorderPoint);
        map.set(rule.productId, current);
        return map;
      }, new Map<number, { safetyStock: Prisma.Decimal; reorderPoint: Prisma.Decimal }>());

      const data = materials.map(material => {
        const position = availability.get(`${material.id}:${warehouseId ?? 0}`);
        const available = position?.available ?? ZERO;
        const rule = ruleByProduct.get(material.id);
        return {
          ...material,
          onHandQuantity: position?.onHand ?? ZERO,
          reservedQuantity: position?.reserved ?? ZERO,
          availableQuantity: available,
          incomingQuantity: incoming.get(material.id) ?? ZERO,
          stockValue: roundCost(position?.value ?? ZERO),
          safetyStock: rule ? roundQuantity(rule.safetyStock) : null,
          reorderPoint: rule ? roundQuantity(rule.reorderPoint) : null,
          isBelowSafetyStock: rule
            ? available.lessThan(rule.safetyStock)
            : false,
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

  /**
   * POST /api/materials/availability
   * "Can we build N of this?" — explodes the BOM and checks every leaf
   * against free stock, reporting substitutes where the answer is no.
   */
  async availability(req: Request, res: Response) {
    const operation = "Check material availability";
    try {
      const result = await checkMaterialAvailability({
        productId: parseId(String(req.body.productId), "productId"),
        bomId: parseOptionalId(req.body.bomId),
        quantity: req.body.quantity ?? 1,
        warehouseId: parseOptionalId(req.body.warehouseId),
        includeSubstitutes: req.body.includeSubstitutes !== false,
      });
      return res.json({ data: result });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** GET /api/materials/consumption */
  async consumption(req: Request, res: Response) {
    const operation = "Material consumption report";
    try {
      const { from, to } = parseDateRange(req, 30);
      const report = await getConsumptionReport({
        from,
        to,
        warehouseId: parseOptionalId(req.query.warehouseId),
        itemTypes: parseEnumList(ItemType, req.query.itemType, "itemType"),
      });
      return res.json({ data: report });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  // ------------------------------------------------- material requisitions

  /** GET /api/materials/requisitions */
  async listRequisitions(req: Request, res: Response) {
    const operation = "List material requisitions";
    try {
      const pagination = parsePagination(req, 25);
      const status = parseEnum(
        MaterialRequisitionStatus,
        req.query.status,
        "status"
      );
      const warehouseId = parseOptionalId(req.query.warehouseId);

      const where: Prisma.MaterialRequisitionWhereInput = {
        ...(status ? { status } : {}),
        ...(warehouseId ? { warehouseId } : {}),
      };

      const [totalItems, requisitions] = await Promise.all([
        prisma.materialRequisition.count({ where }),
        prisma.materialRequisition.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { createdAt: "desc" },
          include: {
            warehouse: { select: { id: true, code: true, name: true } },
            requestedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
            issuedBy: { select: { id: true, firstName: true, lastName: true } },
            productionOrder: { select: { id: true, orderNumber: true } },
            _count: { select: { lines: true } },
          },
        }),
      ]);

      return res.json({
        data: requisitions,
        pagination: paginationMeta(totalItems, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** GET /api/materials/requisitions/:id */
  async getRequisition(req: Request, res: Response) {
    const operation = "Get material requisition";
    try {
      const id = parseId(req.params.id, "Requisition id");
      const requisition = await prisma.materialRequisition.findUnique({
        where: { id },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          requestedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          issuedBy: { select: { id: true, firstName: true, lastName: true } },
          productionOrder: {
            select: { id: true, orderNumber: true, status: true },
          },
          lines: {
            orderBy: { id: "asc" },
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
              uom: { select: { id: true, code: true } },
            },
          },
        },
      });
      if (!requisition) throw new NotFoundError("Material requisition");

      // Show the live position next to each line so the storekeeper knows
      // whether the issue will actually go through.
      const availability = await getAvailability(
        requisition.lines.map(line => line.productId),
        requisition.warehouseId
      );

      return res.json({
        data: {
          ...requisition,
          lines: requisition.lines.map(line => ({
            ...line,
            availableQuantity:
              availability.get(`${line.productId}:${requisition.warehouseId}`)
                ?.available ?? ZERO,
          })),
        },
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** POST /api/materials/requisitions */
  async createRequisition(req: Request, res: Response) {
    const operation = "Create material requisition";
    try {
      const userId = requireUserId(req);
      const warehouseId = parseId(String(req.body.warehouseId), "warehouseId");
      const lines = requireArray<{
        productId: number;
        requestedQuantity: string | number;
        uomId?: number;
        notes?: string;
      }>(req.body.lines, "lines");

      const requisition = await prisma.$transaction(async tx => {
        const requisitionNumber = await nextDocumentNumber(
          tx,
          SEQUENCE_KEYS.MATERIAL_REQUISITION
        );

        return tx.materialRequisition.create({
          data: {
            requisitionNumber,
            warehouseId,
            productionOrderId: parseOptionalId(req.body.productionOrderId),
            status: MaterialRequisitionStatus.DRAFT,
            requiredByDate: parseDate(
              req.body.requiredByDate,
              "requiredByDate"
            ),
            purpose: optionalString(req.body.purpose),
            notes: optionalString(req.body.notes),
            requestedById: userId,
            lines: {
              create: lines.map((line, index) => ({
                productId: parseId(
                  String(line.productId),
                  `lines[${index}].productId`
                ),
                requestedQuantity: toDecimal(
                  line.requestedQuantity,
                  `lines[${index}].requestedQuantity`
                ),
                uomId: parseOptionalId(line.uomId),
                notes: optionalString(line.notes),
              })),
            },
          },
          include: { lines: true },
        });
      });

      return res.status(201).json({ data: requisition });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /**
   * POST /api/materials/requisitions/:id/issue
   * Issue stock against a requisition. Only what is asked for can be issued,
   * and the issue is posted through the stock engine so cost layers and the
   * ledger stay right.
   */
  async issueRequisition(req: Request, res: Response) {
    const operation = "Issue material requisition";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "Requisition id");
      const requestedLines = Array.isArray(req.body.lines)
        ? req.body.lines
        : null;

      const result = await prisma.$transaction(async tx => {
        const requisition = await tx.materialRequisition.findUnique({
          where: { id },
          include: {
            lines: { include: { product: { select: { code: true } } } },
          },
        });
        if (!requisition) throw new NotFoundError("Material requisition");
        if (requisition.status === MaterialRequisitionStatus.CANCELLED) {
          throw new DomainError("A cancelled requisition cannot be issued", {
            code: "REQUISITION_CANCELLED",
          });
        }
        if (requisition.status === MaterialRequisitionStatus.ISSUED) {
          throw new DomainError(
            "This requisition has already been fully issued",
            { code: "ALREADY_ISSUED" }
          );
        }

        const issueLines = (requestedLines ??
          requisition.lines.map(line => ({
            lineId: line.id,
            quantity: line.requestedQuantity
              .minus(line.issuedQuantity)
              .toString(),
          }))) as Array<{
          lineId: number;
          quantity: string | number;
          consumptionType?: "CONSUMED" | "WASTED";
          reasonCode?: string;
          binId?: number;
          lotId?: number;
        }>;

        const prepared: Array<{
          lineId: number;
          productId: number;
          quantity: Prisma.Decimal;
          consumptionType: "CONSUMED" | "WASTED";
          reasonCode: string | null;
          binId: number | null;
          lotId: number | null;
        }> = [];

        for (const issue of issueLines) {
          const line = requisition.lines.find(
            entry => entry.id === Number(issue.lineId)
          );
          if (!line)
            throw new NotFoundError(`Requisition line ${issue.lineId}`);

          const quantity = toDecimal(issue.quantity, "quantity");
          if (quantity.lessThanOrEqualTo(0)) continue;

          const outstanding = line.requestedQuantity.minus(line.issuedQuantity);
          if (quantity.greaterThan(outstanding)) {
            throw new DomainError(
              `Only ${outstanding.toFixed(4)} of ${line.product.code} is still outstanding on ${requisition.requisitionNumber}`,
              { code: "QUANTITY_EXCEEDS_REQUEST" }
            );
          }

          prepared.push({
            lineId: line.id,
            productId: line.productId,
            quantity,
            consumptionType: issue.consumptionType ?? "CONSUMED",
            reasonCode: issue.reasonCode ?? null,
            binId: issue.binId ? Number(issue.binId) : null,
            lotId: issue.lotId ? Number(issue.lotId) : null,
          });
        }

        if (prepared.length === 0) {
          throw new DomainError(
            "There is nothing left to issue on this requisition",
            { code: "NOTHING_TO_ISSUE" }
          );
        }

        const issued = await issueMaterial(tx, {
          warehouseId: requisition.warehouseId,
          productionOrderId: requisition.productionOrderId,
          reference: {
            type: "MATERIAL_REQUISITION",
            id: requisition.id,
            number: requisition.requisitionNumber,
          },
          performedById: userId,
          notes: optionalString(req.body.notes),
          lines: prepared.map(line => ({
            productId: line.productId,
            quantity: line.quantity,
            consumptionType: line.consumptionType,
            reasonCode: line.reasonCode,
            binId: line.binId,
            lotId: line.lotId,
          })),
        });

        for (const line of prepared) {
          const existing = requisition.lines.find(
            entry => entry.id === line.lineId
          );
          if (!existing) continue;
          await tx.materialRequisitionLine.update({
            where: { id: line.lineId },
            data: {
              issuedQuantity: roundQuantity(
                existing.issuedQuantity.plus(line.quantity)
              ),
            },
          });
        }

        const refreshed = await tx.materialRequisitionLine.findMany({
          where: { requisitionId: id },
        });
        const fullyIssued = refreshed.every(line =>
          line.issuedQuantity.greaterThanOrEqualTo(line.requestedQuantity)
        );

        const updated = await tx.materialRequisition.update({
          where: { id },
          data: {
            status: fullyIssued
              ? MaterialRequisitionStatus.ISSUED
              : MaterialRequisitionStatus.PARTIALLY_ISSUED,
            issuedById: userId,
            issuedAt: new Date(),
          },
          include: { lines: true },
        });

        return { requisition: updated, issued };
      });

      return res.json({ data: result });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** PATCH /api/materials/requisitions/:id/cancel */
  async cancelRequisition(req: Request, res: Response) {
    const operation = "Cancel material requisition";
    try {
      const id = parseId(req.params.id, "Requisition id");
      const requisition = await prisma.materialRequisition.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!requisition) throw new NotFoundError("Material requisition");

      const issued = requisition.lines.some(line =>
        line.issuedQuantity.greaterThan(0)
      );
      if (issued) {
        throw new DomainError(
          "Material has already been issued against this requisition; it can no longer be cancelled",
          { status: 409, code: "ALREADY_ISSUED" }
        );
      }

      const updated = await prisma.materialRequisition.update({
        where: { id },
        data: { status: MaterialRequisitionStatus.CANCELLED },
      });

      return res.json({ data: updated });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /**
   * GET /api/materials/shortages
   * Every material sitting under its safety stock, ordered by how deep the
   * hole is. This is the buyer's daily worklist.
   */
  async shortages(req: Request, res: Response) {
    const operation = "Material shortages";
    try {
      const warehouseId = parseOptionalId(req.query.warehouseId);

      const rules = await prisma.reorderRule.findMany({
        where: {
          isActive: true,
          ...(warehouseId ? { warehouseId } : {}),
          product: { itemType: { in: MATERIAL_ITEM_TYPES } },
        },
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              itemType: true,
              uom: { select: { code: true } },
              standardCost: true,
            },
          },
          warehouse: { select: { id: true, code: true, name: true } },
          preferredSupplier: {
            select: { id: true, code: true, name: true, leadTimeDays: true },
          },
        },
      });

      const productIds = [...new Set(rules.map(rule => rule.productId))];
      const warehouseIds = [...new Set(rules.map(rule => rule.warehouseId))];
      const [availability, incoming] = await Promise.all([
        getAvailabilityByWarehouse(productIds, warehouseIds),
        getIncomingQuantityByWarehouse(productIds, warehouseIds),
      ]);

      const rows = [];
      for (const rule of rules) {
        const key = `${rule.productId}:${rule.warehouseId}`;
        const position = availability.get(key);
        const available = position?.available ?? ZERO;
        const incomingQuantity = incoming.get(key) ?? ZERO;
        const projected = available.plus(incomingQuantity);

        if (
          projected.greaterThanOrEqualTo(rule.safetyStock) &&
          available.greaterThan(0)
        )
          continue;

        rows.push({
          product: rule.product,
          warehouse: rule.warehouse,
          preferredSupplier: rule.preferredSupplier,
          onHandQuantity: position?.onHand ?? ZERO,
          availableQuantity: available,
          incomingQuantity,
          projectedQuantity: projected,
          safetyStock: rule.safetyStock,
          reorderPoint: rule.reorderPoint,
          reorderQuantity: rule.reorderQuantity,
          shortfallQuantity: roundQuantity(
            Prisma.Decimal.max(ZERO, rule.safetyStock.minus(projected))
          ),
          leadTimeDays:
            rule.leadTimeDays || rule.preferredSupplier?.leadTimeDays || 0,
          estimatedValue: roundCost(
            Prisma.Decimal.max(ZERO, rule.safetyStock.minus(projected)).times(
              rule.product.standardCost ?? ZERO
            )
          ),
          autoRequisition: rule.autoRequisition,
        });
      }

      rows.sort((a, b) => b.shortfallQuantity.comparedTo(a.shortfallQuantity));

      return res.json({
        data: {
          totalShortages: rows.length,
          criticalShortages: rows.filter(row =>
            row.availableQuantity.lessThanOrEqualTo(0)
          ).length,
          rows,
        },
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }
}
