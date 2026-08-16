import { Request, Response } from "express";
import { prisma } from "@repo/db";
import {
  Prisma,
  AuditCategory,
  BomChangeType,
  BomStatus,
} from "@prisma/client";
import {
  assertNoCircularReference,
  explodeBom,
  logBomChange,
  reviseBom,
  rollUpBomCost,
  whereUsed,
} from "../services/supplyChain/bom.service.js";
import {
  nextDocumentNumber,
  SEQUENCE_KEYS,
} from "../services/supplyChain/numbering.service.js";
import { DomainError, NotFoundError } from "../services/supplyChain/errors.js";
import { toDecimal } from "../services/supplyChain/decimal.js";
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
  requireArray,
  requireString,
  requireUserId,
} from "../utils/supplyChainHttp.js";

const BOM_LIST_INCLUDE = {
  product: { select: { id: true, code: true, name: true, itemType: true } },
  uom: { select: { id: true, code: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { components: true } },
} as const;

export class BomController {
  /** GET /api/boms */
  async list(req: Request, res: Response) {
    const operation = "List bills of materials";
    try {
      const pagination = parsePagination(req, 25);
      const status = parseEnum(BomStatus, req.query.status, "status");
      const productId = parseOptionalId(req.query.productId);
      const search = optionalString(req.query.search);

      const where: Prisma.BillOfMaterialsWhereInput = {
        ...(status ? { status } : {}),
        ...(productId ? { productId } : {}),
        ...(search
          ? {
              OR: [
                { bomNumber: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
                {
                  product: { code: { contains: search, mode: "insensitive" } },
                },
                {
                  product: { name: { contains: search, mode: "insensitive" } },
                },
              ],
            }
          : {}),
      };

      const [totalItems, boms] = await Promise.all([
        prisma.billOfMaterials.count({ where }),
        prisma.billOfMaterials.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: [{ productId: "asc" }, { version: "desc" }],
          include: BOM_LIST_INCLUDE,
        }),
      ]);

      return res.json({
        data: boms,
        pagination: paginationMeta(totalItems, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** GET /api/boms/:id */
  async getById(req: Request, res: Response) {
    const operation = "Get bill of materials";
    try {
      const id = parseId(req.params.id, "BOM id");
      const bom = await prisma.billOfMaterials.findUnique({
        where: { id },
        include: {
          ...BOM_LIST_INCLUDE,
          previousVersion: {
            select: {
              id: true,
              bomNumber: true,
              version: true,
              revision: true,
            },
          },
          nextVersion: {
            select: {
              id: true,
              bomNumber: true,
              version: true,
              revision: true,
            },
          },
          components: {
            orderBy: { lineNumber: "asc" },
            include: {
              componentProduct: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  itemType: true,
                  isManufactured: true,
                  standardCost: true,
                  uom: { select: { code: true } },
                },
              },
              uom: { select: { id: true, code: true } },
              substitutes: {
                orderBy: { priority: "asc" },
                include: {
                  substituteProduct: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      standardCost: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!bom) throw new NotFoundError("Bill of materials");
      return res.json({ data: bom });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** POST /api/boms */
  async create(req: Request, res: Response) {
    const operation = "Create bill of materials";
    try {
      const userId = requireUserId(req);
      const productId = parseId(String(req.body.productId), "productId");

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      if (!product) throw new NotFoundError("Product");

      const components = Array.isArray(req.body.components)
        ? req.body.components
        : [];
      for (const component of components) {
        const componentProductId = parseId(
          String(component.componentProductId),
          "componentProductId"
        );
        await assertNoCircularReference(productId, componentProductId);
      }

      const isDefault = parseBoolean(req.body.isDefault) ?? false;

      const bom = await prisma.$transaction(async tx => {
        const highest = await tx.billOfMaterials.findFirst({
          where: { productId },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        const version = (highest?.version ?? 0) + 1;
        const bomNumber = await nextDocumentNumber(tx, SEQUENCE_KEYS.BOM);

        if (isDefault) {
          await tx.billOfMaterials.updateMany({
            where: { productId, isDefault: true },
            data: { isDefault: false },
          });
        }

        const created = await tx.billOfMaterials.create({
          data: {
            bomNumber,
            productId,
            name: requireString(req.body.name, "name"),
            version,
            revision: optionalString(req.body.revision) ?? "A",
            status: BomStatus.DRAFT,
            isDefault,
            outputQuantity: toDecimal(
              req.body.outputQuantity ?? 1,
              "outputQuantity"
            ),
            uomId: parseOptionalId(req.body.uomId) ?? product.uomId,
            effectiveFrom: parseDate(req.body.effectiveFrom, "effectiveFrom"),
            effectiveTo: parseDate(req.body.effectiveTo, "effectiveTo"),
            laborCost: toDecimal(req.body.laborCost ?? 0, "laborCost"),
            overheadCost: toDecimal(req.body.overheadCost ?? 0, "overheadCost"),
            notes: optionalString(req.body.notes),
            createdById: userId,
          },
        });

        for (const [index, component] of components.entries()) {
          await tx.bomComponent.create({
            data: {
              bomId: created.id,
              componentProductId: Number(component.componentProductId),
              lineNumber: Number(component.lineNumber) || index + 1,
              quantity: toDecimal(
                component.quantity,
                `components[${index}].quantity`
              ),
              uomId: parseOptionalId(component.uomId),
              scrapPercent: toDecimal(
                component.scrapPercent ?? 0,
                "scrapPercent"
              ),
              isOptional: parseBoolean(component.isOptional) ?? false,
              isPhantom: parseBoolean(component.isPhantom) ?? false,
              operationSequence: parseOptionalId(component.operationSequence),
              referenceDesignator: optionalString(
                component.referenceDesignator
              ),
              notes: optionalString(component.notes),
            },
          });
        }

        // The product is manufactured by definition once it has a structure.
        if (!product.isManufactured) {
          await tx.product.update({
            where: { id: productId },
            data: { isManufactured: true },
          });
        }

        await logBomChange(tx, {
          bomId: created.id,
          changeType: BomChangeType.CREATED,
          description: `BOM ${created.bomNumber} created for ${product.code} with ${components.length} component(s)`,
          changedById: userId,
        });

        await tx.auditLog.create({
          data: {
            entityType: "BillOfMaterials",
            entityId: created.id,
            changedBy: userId,
            action: "CREATE",
            category: AuditCategory.BOM_MANAGEMENT,
            newValues: {
              bomNumber: created.bomNumber,
              productCode: product.code,
              version,
            },
          },
        });

        return created;
      });

      const full = await prisma.billOfMaterials.findUnique({
        where: { id: bom.id },
        include: BOM_LIST_INCLUDE,
      });
      return res.status(201).json({ data: full });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** PUT /api/boms/:id */
  async update(req: Request, res: Response) {
    const operation = "Update bill of materials";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "BOM id");

      const existing = await prisma.billOfMaterials.findUnique({
        where: { id },
      });
      if (!existing) throw new NotFoundError("Bill of materials");
      if (existing.status === BomStatus.OBSOLETE) {
        throw new DomainError(
          "An obsolete BOM cannot be edited; create a revision instead",
          { code: "BOM_OBSOLETE" }
        );
      }
      if (existing.status === BomStatus.ACTIVE) {
        throw new DomainError(
          "An active BOM is frozen so production orders stay reproducible. Create a revision to change it.",
          { code: "BOM_ACTIVE_FROZEN" }
        );
      }

      const isDefault = parseBoolean(req.body.isDefault);

      const updated = await prisma.$transaction(async tx => {
        if (isDefault === true) {
          await tx.billOfMaterials.updateMany({
            where: {
              productId: existing.productId,
              isDefault: true,
              id: { not: id },
            },
            data: { isDefault: false },
          });
        }

        const bom = await tx.billOfMaterials.update({
          where: { id },
          data: {
            ...(req.body.name !== undefined
              ? { name: requireString(req.body.name, "name") }
              : {}),
            ...(req.body.revision !== undefined
              ? { revision: requireString(req.body.revision, "revision") }
              : {}),
            ...(req.body.outputQuantity !== undefined
              ? {
                  outputQuantity: toDecimal(
                    req.body.outputQuantity,
                    "outputQuantity"
                  ),
                }
              : {}),
            ...(req.body.uomId !== undefined
              ? { uomId: parseOptionalId(req.body.uomId) }
              : {}),
            ...(req.body.effectiveFrom !== undefined
              ? {
                  effectiveFrom: parseDate(
                    req.body.effectiveFrom,
                    "effectiveFrom"
                  ),
                }
              : {}),
            ...(req.body.effectiveTo !== undefined
              ? { effectiveTo: parseDate(req.body.effectiveTo, "effectiveTo") }
              : {}),
            ...(req.body.laborCost !== undefined
              ? { laborCost: toDecimal(req.body.laborCost, "laborCost") }
              : {}),
            ...(req.body.overheadCost !== undefined
              ? {
                  overheadCost: toDecimal(
                    req.body.overheadCost,
                    "overheadCost"
                  ),
                }
              : {}),
            ...(req.body.notes !== undefined
              ? { notes: optionalString(req.body.notes) }
              : {}),
            ...(isDefault !== undefined ? { isDefault } : {}),
          },
        });

        await logBomChange(tx, {
          bomId: id,
          changeType: BomChangeType.HEADER_UPDATED,
          description: `Header updated on ${bom.bomNumber}`,
          changedById: userId,
          reason: optionalString(req.body.reason),
        });

        return bom;
      });

      return res.json({ data: updated });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /**
   * PATCH /api/boms/:id/status
   * Activating a BOM retires the previously active one for the same product,
   * because two live structures for one item is how the wrong thing gets
   * built.
   */
  async changeStatus(req: Request, res: Response) {
    const operation = "Change BOM status";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "BOM id");
      const status = parseEnum(
        BomStatus,
        req.body.status,
        "status",
        true
      ) as BomStatus;

      const updated = await prisma.$transaction(async tx => {
        const existing = await tx.billOfMaterials.findUnique({
          where: { id },
          include: { components: true, product: { select: { code: true } } },
        });
        if (!existing) throw new NotFoundError("Bill of materials");

        if (status === BomStatus.ACTIVE) {
          if (existing.components.length === 0) {
            throw new DomainError(
              "A BOM with no components cannot be activated",
              { code: "BOM_EMPTY" }
            );
          }
          await tx.billOfMaterials.updateMany({
            where: {
              productId: existing.productId,
              status: BomStatus.ACTIVE,
              id: { not: id },
            },
            data: { status: BomStatus.OBSOLETE, effectiveTo: new Date() },
          });
        }

        if (status === BomStatus.OBSOLETE) {
          const openOrders = await tx.productionOrder.count({
            where: {
              bomId: id,
              status: { in: ["DRAFT", "PLANNED", "RELEASED", "IN_PROGRESS"] },
            },
          });
          if (openOrders > 0) {
            throw new DomainError(
              `${openOrders} open production order(s) still use this BOM; close them before retiring it`,
              { status: 409, code: "BOM_IN_USE" }
            );
          }
        }

        const bom = await tx.billOfMaterials.update({
          where: { id },
          data: {
            status,
            ...(status === BomStatus.ACTIVE
              ? {
                  approvedById: userId,
                  approvedAt: new Date(),
                  effectiveFrom: existing.effectiveFrom ?? new Date(),
                }
              : {}),
            ...(status === BomStatus.OBSOLETE
              ? { effectiveTo: new Date() }
              : {}),
          },
        });

        await logBomChange(tx, {
          bomId: id,
          changeType: BomChangeType.STATUS_CHANGED,
          fieldName: "status",
          oldValue: existing.status,
          newValue: status,
          description: `Status changed from ${existing.status} to ${status}`,
          reason: optionalString(req.body.reason),
          changedById: userId,
        });

        await tx.auditLog.create({
          data: {
            entityType: "BillOfMaterials",
            entityId: id,
            changedBy: userId,
            action: "STATUS_CHANGE",
            category: AuditCategory.BOM_MANAGEMENT,
            oldValues: { status: existing.status },
            newValues: { status },
          },
        });

        return bom;
      });

      return res.json({ data: updated });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** POST /api/boms/:id/components */
  async addComponent(req: Request, res: Response) {
    const operation = "Add BOM component";
    try {
      const userId = requireUserId(req);
      const bomId = parseId(req.params.id, "BOM id");
      const componentProductId = parseId(
        String(req.body.componentProductId),
        "componentProductId"
      );

      const bom = await prisma.billOfMaterials.findUnique({
        where: { id: bomId },
      });
      if (!bom) throw new NotFoundError("Bill of materials");
      if (
        bom.status === BomStatus.ACTIVE ||
        bom.status === BomStatus.OBSOLETE
      ) {
        throw new DomainError(
          "Components can only be changed on a draft BOM; create a revision instead",
          {
            code: "BOM_FROZEN",
          }
        );
      }

      await assertNoCircularReference(bom.productId, componentProductId);

      const component = await prisma.$transaction(async tx => {
        const highest = await tx.bomComponent.findFirst({
          where: { bomId },
          orderBy: { lineNumber: "desc" },
          select: { lineNumber: true },
        });

        const created = await tx.bomComponent.create({
          data: {
            bomId,
            componentProductId,
            lineNumber:
              Number(req.body.lineNumber) || (highest?.lineNumber ?? 0) + 10,
            quantity: toDecimal(req.body.quantity, "quantity"),
            uomId: parseOptionalId(req.body.uomId),
            scrapPercent: toDecimal(req.body.scrapPercent ?? 0, "scrapPercent"),
            isOptional: parseBoolean(req.body.isOptional) ?? false,
            isPhantom: parseBoolean(req.body.isPhantom) ?? false,
            operationSequence: parseOptionalId(req.body.operationSequence),
            referenceDesignator: optionalString(req.body.referenceDesignator),
            notes: optionalString(req.body.notes),
          },
          include: {
            componentProduct: { select: { id: true, code: true, name: true } },
          },
        });

        await logBomChange(tx, {
          bomId,
          changeType: BomChangeType.COMPONENT_ADDED,
          fieldName: "components",
          newValue: `${created.componentProduct.code} x ${created.quantity.toString()}`,
          description: `Added ${created.componentProduct.code} (${created.quantity.toString()})`,
          reason: optionalString(req.body.reason),
          changedById: userId,
        });

        return created;
      });

      return res.status(201).json({ data: component });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** PUT /api/boms/components/:componentId */
  async updateComponent(req: Request, res: Response) {
    const operation = "Update BOM component";
    try {
      const userId = requireUserId(req);
      const componentId = parseId(req.params.componentId, "Component id");

      const existing = await prisma.bomComponent.findUnique({
        where: { id: componentId },
        include: { bom: true, componentProduct: { select: { code: true } } },
      });
      if (!existing) throw new NotFoundError("BOM component");
      if (
        existing.bom.status === BomStatus.ACTIVE ||
        existing.bom.status === BomStatus.OBSOLETE
      ) {
        throw new DomainError(
          "Components can only be changed on a draft BOM; create a revision instead",
          {
            code: "BOM_FROZEN",
          }
        );
      }

      const updated = await prisma.$transaction(async tx => {
        const component = await tx.bomComponent.update({
          where: { id: componentId },
          data: {
            ...(req.body.quantity !== undefined
              ? { quantity: toDecimal(req.body.quantity, "quantity") }
              : {}),
            ...(req.body.lineNumber !== undefined
              ? {
                  lineNumber:
                    Number(req.body.lineNumber) || existing.lineNumber,
                }
              : {}),
            ...(req.body.uomId !== undefined
              ? { uomId: parseOptionalId(req.body.uomId) }
              : {}),
            ...(req.body.scrapPercent !== undefined
              ? {
                  scrapPercent: toDecimal(
                    req.body.scrapPercent,
                    "scrapPercent"
                  ),
                }
              : {}),
            ...(parseBoolean(req.body.isOptional) !== undefined
              ? { isOptional: parseBoolean(req.body.isOptional) }
              : {}),
            ...(parseBoolean(req.body.isPhantom) !== undefined
              ? { isPhantom: parseBoolean(req.body.isPhantom) }
              : {}),
            ...(req.body.operationSequence !== undefined
              ? {
                  operationSequence: parseOptionalId(
                    req.body.operationSequence
                  ),
                }
              : {}),
            ...(req.body.referenceDesignator !== undefined
              ? {
                  referenceDesignator: optionalString(
                    req.body.referenceDesignator
                  ),
                }
              : {}),
            ...(req.body.notes !== undefined
              ? { notes: optionalString(req.body.notes) }
              : {}),
          },
        });

        await logBomChange(tx, {
          bomId: existing.bomId,
          changeType: BomChangeType.COMPONENT_UPDATED,
          fieldName: "quantity",
          oldValue: existing.quantity.toString(),
          newValue: component.quantity.toString(),
          description: `Updated ${existing.componentProduct.code}`,
          reason: optionalString(req.body.reason),
          changedById: userId,
        });

        return component;
      });

      return res.json({ data: updated });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** DELETE /api/boms/components/:componentId */
  async removeComponent(req: Request, res: Response) {
    const operation = "Remove BOM component";
    try {
      const userId = requireUserId(req);
      const componentId = parseId(req.params.componentId, "Component id");

      const existing = await prisma.bomComponent.findUnique({
        where: { id: componentId },
        include: { bom: true, componentProduct: { select: { code: true } } },
      });
      if (!existing) throw new NotFoundError("BOM component");
      if (
        existing.bom.status === BomStatus.ACTIVE ||
        existing.bom.status === BomStatus.OBSOLETE
      ) {
        throw new DomainError(
          "Components can only be changed on a draft BOM; create a revision instead",
          {
            code: "BOM_FROZEN",
          }
        );
      }

      await prisma.$transaction(async tx => {
        await tx.bomComponent.delete({ where: { id: componentId } });
        await logBomChange(tx, {
          bomId: existing.bomId,
          changeType: BomChangeType.COMPONENT_REMOVED,
          oldValue: `${existing.componentProduct.code} x ${existing.quantity.toString()}`,
          description: `Removed ${existing.componentProduct.code}`,
          reason: optionalString(req.body.reason),
          changedById: userId,
        });
      });

      return res.status(204).send();
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** POST /api/boms/components/:componentId/substitutes */
  async addSubstitute(req: Request, res: Response) {
    const operation = "Add component substitute";
    try {
      const userId = requireUserId(req);
      const componentId = parseId(req.params.componentId, "Component id");
      const substituteProductId = parseId(
        String(req.body.substituteProductId),
        "substituteProductId"
      );

      const component = await prisma.bomComponent.findUnique({
        where: { id: componentId },
        include: { bom: true, componentProduct: { select: { code: true } } },
      });
      if (!component) throw new NotFoundError("BOM component");
      if (component.componentProductId === substituteProductId) {
        throw new DomainError("A component cannot substitute for itself", {
          code: "VALIDATION_ERROR",
        });
      }

      await assertNoCircularReference(
        component.bom.productId,
        substituteProductId
      );

      const substitute = await prisma.$transaction(async tx => {
        const created = await tx.bomComponentSubstitute.create({
          data: {
            bomComponentId: componentId,
            substituteProductId,
            priority: Number(req.body.priority) || 1,
            conversionFactor: toDecimal(
              req.body.conversionFactor ?? 1,
              "conversionFactor"
            ),
            isActive: parseBoolean(req.body.isActive) ?? true,
            notes: optionalString(req.body.notes),
          },
          include: {
            substituteProduct: { select: { id: true, code: true, name: true } },
          },
        });

        await logBomChange(tx, {
          bomId: component.bomId,
          changeType: BomChangeType.SUBSTITUTE_ADDED,
          newValue: created.substituteProduct.code,
          description: `Added ${created.substituteProduct.code} as a substitute for ${component.componentProduct.code}`,
          reason: optionalString(req.body.reason),
          changedById: userId,
        });

        return created;
      });

      return res.status(201).json({ data: substitute });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** DELETE /api/boms/substitutes/:substituteId */
  async removeSubstitute(req: Request, res: Response) {
    const operation = "Remove component substitute";
    try {
      const userId = requireUserId(req);
      const substituteId = parseId(req.params.substituteId, "Substitute id");

      const existing = await prisma.bomComponentSubstitute.findUnique({
        where: { id: substituteId },
        include: {
          bomComponent: true,
          substituteProduct: { select: { code: true } },
        },
      });
      if (!existing) throw new NotFoundError("Component substitute");

      await prisma.$transaction(async tx => {
        await tx.bomComponentSubstitute.delete({ where: { id: substituteId } });
        await logBomChange(tx, {
          bomId: existing.bomComponent.bomId,
          changeType: BomChangeType.SUBSTITUTE_REMOVED,
          oldValue: existing.substituteProduct.code,
          description: `Removed substitute ${existing.substituteProduct.code}`,
          changedById: userId,
        });
      });

      return res.status(204).send();
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /**
   * GET /api/boms/:id/explode
   * The full indented structure for a build quantity.
   */
  async explode(req: Request, res: Response) {
    const operation = "Explode bill of materials";
    try {
      const id = parseId(req.params.id, "BOM id");
      const bom = await prisma.billOfMaterials.findUnique({
        where: { id },
        select: { productId: true },
      });
      if (!bom) throw new NotFoundError("Bill of materials");

      const quantity = req.query.quantity
        ? toDecimal(String(req.query.quantity), "quantity")
        : 1;
      const maxLevels = parseOptionalId(req.query.maxLevels);

      const result = await explodeBom({
        productId: bom.productId,
        bomId: id,
        quantity,
        ...(maxLevels !== null ? { maxLevels } : {}),
      });

      return res.json({
        data: {
          bom: {
            id: result.bom.id,
            bomNumber: result.bom.bomNumber,
            name: result.bom.name,
            version: result.bom.version,
            revision: result.bom.revision,
            status: result.bom.status,
            outputQuantity: result.bom.outputQuantity,
            product: result.bom.product,
          },
          quantity,
          components: result.components,
          totalMaterialCost: result.totalMaterialCost,
        },
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** POST /api/boms/:id/cost-rollup */
  async costRollup(req: Request, res: Response) {
    const operation = "Roll up BOM cost";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "BOM id");
      const persist = parseBoolean(req.body.persist) ?? true;

      const result = await rollUpBomCost(id, {
        persist,
        changedById: persist ? userId : undefined,
      });
      return res.json({ data: result });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** GET /api/boms/where-used/:productId */
  async whereUsed(req: Request, res: Response) {
    const operation = "BOM where-used";
    try {
      const productId = parseId(req.params.productId, "Product id");
      const data = await whereUsed(productId);
      return res.json({ data });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** POST /api/boms/:id/revise */
  async revise(req: Request, res: Response) {
    const operation = "Revise bill of materials";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "BOM id");

      const created = await prisma.$transaction(tx =>
        reviseBom(tx, id, {
          changedById: userId,
          reason: optionalString(req.body.reason),
          revision: optionalString(req.body.revision),
        })
      );

      const full = await prisma.billOfMaterials.findUnique({
        where: { id: created.id },
        include: BOM_LIST_INCLUDE,
      });
      return res.status(201).json({ data: full });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** GET /api/boms/:id/history */
  async history(req: Request, res: Response) {
    const operation = "Get BOM change history";
    try {
      const id = parseId(req.params.id, "BOM id");
      const pagination = parsePagination(req, 50);

      const [totalItems, logs] = await Promise.all([
        prisma.bomChangeLog.count({ where: { bomId: id } }),
        prisma.bomChangeLog.findMany({
          where: { bomId: id },
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { createdAt: "desc" },
          include: {
            changedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        }),
      ]);

      return res.json({
        data: logs,
        pagination: paginationMeta(totalItems, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /**
   * POST /api/boms/:id/components/bulk
   * Replace a draft BOM's component list in one call, which is what the
   * structure editor in the UI posts.
   */
  async replaceComponents(req: Request, res: Response) {
    const operation = "Replace BOM components";
    try {
      const userId = requireUserId(req);
      const bomId = parseId(req.params.id, "BOM id");
      const components = requireArray<Record<string, unknown>>(
        req.body.components,
        "components"
      );

      const bom = await prisma.billOfMaterials.findUnique({
        where: { id: bomId },
      });
      if (!bom) throw new NotFoundError("Bill of materials");
      if (bom.status !== BomStatus.DRAFT) {
        throw new DomainError(
          "Only a draft BOM can have its structure replaced",
          { code: "BOM_FROZEN" }
        );
      }

      for (const component of components) {
        await assertNoCircularReference(
          bom.productId,
          Number(component.componentProductId)
        );
      }

      const seen = new Set<number>();
      for (const component of components) {
        const productId = Number(component.componentProductId);
        if (seen.has(productId)) {
          throw new DomainError(
            "The same component appears more than once; merge the quantities instead",
            {
              code: "DUPLICATE_COMPONENT",
            }
          );
        }
        seen.add(productId);
      }

      const result = await prisma.$transaction(async tx => {
        await tx.bomComponent.deleteMany({ where: { bomId } });

        for (const [index, component] of components.entries()) {
          await tx.bomComponent.create({
            data: {
              bomId,
              componentProductId: Number(component.componentProductId),
              lineNumber: Number(component.lineNumber) || (index + 1) * 10,
              quantity: toDecimal(
                component.quantity as string,
                `components[${index}].quantity`
              ),
              uomId: parseOptionalId(component.uomId),
              scrapPercent: toDecimal(
                (component.scrapPercent as string) ?? 0,
                "scrapPercent"
              ),
              isOptional: parseBoolean(component.isOptional) ?? false,
              isPhantom: parseBoolean(component.isPhantom) ?? false,
              operationSequence: parseOptionalId(component.operationSequence),
              referenceDesignator: optionalString(
                component.referenceDesignator
              ),
              notes: optionalString(component.notes),
            },
          });
        }

        await logBomChange(tx, {
          bomId,
          changeType: BomChangeType.COMPONENT_UPDATED,
          description: `Structure replaced with ${components.length} component(s)`,
          reason: optionalString(req.body.reason),
          changedById: userId,
        });

        return tx.billOfMaterials.findUniqueOrThrow({
          where: { id: bomId },
          include: {
            components: {
              orderBy: { lineNumber: "asc" },
              include: {
                componentProduct: {
                  select: { id: true, code: true, name: true },
                },
              },
            },
          },
        });
      });

      return res.json({ data: result });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }
}
