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
import {
  requireNonNegative,
  requirePercentage,
  requirePositive,
} from "../services/supplyChain/decimal.js";
import {
  handleSupplyChainError,
  optionalString,
  paginationMeta,
  parseBoolean,
  parseDate,
  parseEnum,
  parseId,
  parseInteger,
  parseOptionalId,
  parseOptionalInteger,
  parsePagination,
  requireArray,
  requireString,
  requireUserId,
} from "../utils/supply-chain-http.js";

const BOM_LIST_INCLUDE = {
  product: { select: { id: true, code: true, name: true, itemType: true } },
  uom: { select: { id: true, code: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { components: true } },
} as const;

async function lockDraftBom(tx: Prisma.TransactionClient, bomId: number) {
  await tx.$queryRaw`
    SELECT "id" FROM "bills_of_materials" WHERE "id" = ${bomId} FOR UPDATE
  `;
  const bom = await tx.billOfMaterials.findUnique({
    where: { id: bomId },
    select: { id: true, status: true },
  });
  if (!bom) throw new NotFoundError("Bill of materials");
  if (bom.status !== BomStatus.DRAFT) {
    throw new DomainError(
      "Only a draft BOM can be edited. Return a pending BOM to draft or create a revision of an active BOM.",
      { status: 409, code: "BOM_FROZEN" }
    );
  }
}

export class BomController {
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

  async create(req: Request, res: Response) {
    const operation = "Create bill of materials";
    try {
      const userId = requireUserId(req);
      const productId = parseId(String(req.body.productId), "productId");

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      if (!product) throw new NotFoundError("Product");

      if (
        req.body.components !== undefined &&
        (!Array.isArray(req.body.components) ||
          req.body.components.length > 1_000)
      ) {
        throw new DomainError(
          "components must be an array of at most 1000 rows",
          { code: "VALIDATION_ERROR" }
        );
      }
      const components = (
        Array.isArray(req.body.components) ? req.body.components : []
      ) as Record<string, unknown>[];
      const seenComponents = new Set<number>();
      for (const [index, component] of components.entries()) {
        const componentProductId = parseId(
          String(component.componentProductId),
          `components[${index}].componentProductId`
        );
        if (seenComponents.has(componentProductId)) {
          throw new DomainError(
            "The same component appears more than once; merge the quantities instead",
            { code: "DUPLICATE_COMPONENT" }
          );
        }
        seenComponents.add(componentProductId);
        await assertNoCircularReference(productId, componentProductId);
      }

      const isDefault = parseBoolean(req.body.isDefault) ?? false;
      const effectiveFrom = parseDate(req.body.effectiveFrom, "effectiveFrom");
      const effectiveTo = parseDate(req.body.effectiveTo, "effectiveTo");
      if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
        throw new DomainError(
          "effectiveTo cannot be earlier than effectiveFrom",
          { code: "VALIDATION_ERROR" }
        );
      }

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
            outputQuantity: requirePositive(
              req.body.outputQuantity ?? 1,
              "outputQuantity"
            ),
            uomId: parseOptionalId(req.body.uomId) ?? product.uomId,
            effectiveFrom,
            effectiveTo,
            laborCost: requireNonNegative(req.body.laborCost ?? 0, "laborCost"),
            overheadCost: requireNonNegative(
              req.body.overheadCost ?? 0,
              "overheadCost"
            ),
            notes: optionalString(req.body.notes),
            createdById: userId,
          },
        });

        for (const [index, component] of components.entries()) {
          await tx.bomComponent.create({
            data: {
              bomId: created.id,
              componentProductId: parseId(
                String(component.componentProductId),
                `components[${index}].componentProductId`
              ),
              lineNumber:
                parseOptionalInteger(
                  component.lineNumber,
                  `components[${index}].lineNumber`,
                  1,
                  1_000_000
                ) ?? index + 1,
              quantity: requirePositive(
                component.quantity,
                `components[${index}].quantity`
              ),
              uomId: parseOptionalId(component.uomId),
              scrapPercent: requirePercentage(
                component.scrapPercent ?? 0,
                `components[${index}].scrapPercent`
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

  async update(req: Request, res: Response) {
    const operation = "Update bill of materials";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "BOM id");

      const existing = await prisma.billOfMaterials.findUnique({
        where: { id },
      });
      if (!existing) throw new NotFoundError("Bill of materials");
      if (existing.status !== BomStatus.DRAFT) {
        throw new DomainError(
          "Only a draft BOM can be edited. Return a pending BOM to draft or create a revision of an active BOM.",
          { code: "BOM_FROZEN" }
        );
      }

      const isDefault = parseBoolean(req.body.isDefault);
      const nextEffectiveFrom =
        req.body.effectiveFrom === undefined
          ? existing.effectiveFrom
          : parseDate(req.body.effectiveFrom, "effectiveFrom");
      const nextEffectiveTo =
        req.body.effectiveTo === undefined
          ? existing.effectiveTo
          : parseDate(req.body.effectiveTo, "effectiveTo");
      if (
        nextEffectiveFrom &&
        nextEffectiveTo &&
        nextEffectiveTo < nextEffectiveFrom
      ) {
        throw new DomainError(
          "effectiveTo cannot be earlier than effectiveFrom",
          { code: "VALIDATION_ERROR" }
        );
      }

      const updated = await prisma.$transaction(async tx => {
        await lockDraftBom(tx, id);
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
                  outputQuantity: requirePositive(
                    req.body.outputQuantity,
                    "outputQuantity"
                  ),
                }
              : {}),
            ...(req.body.uomId !== undefined
              ? { uomId: parseOptionalId(req.body.uomId) }
              : {}),
            ...(req.body.effectiveFrom !== undefined
              ? { effectiveFrom: nextEffectiveFrom }
              : {}),
            ...(req.body.effectiveTo !== undefined
              ? { effectiveTo: nextEffectiveTo }
              : {}),
            ...(req.body.laborCost !== undefined
              ? {
                  laborCost: requireNonNegative(
                    req.body.laborCost,
                    "laborCost"
                  ),
                }
              : {}),
            ...(req.body.overheadCost !== undefined
              ? {
                  overheadCost: requireNonNegative(
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
        await tx.$queryRaw`
          SELECT "id" FROM "bills_of_materials" WHERE "id" = ${id} FOR UPDATE
        `;
        const existing = await tx.billOfMaterials.findUnique({
          where: { id },
          include: { components: true, product: { select: { code: true } } },
        });
        if (!existing) throw new NotFoundError("Bill of materials");

        const allowedTransitions: Record<BomStatus, BomStatus[]> = {
          [BomStatus.DRAFT]: [BomStatus.PENDING_APPROVAL],
          [BomStatus.PENDING_APPROVAL]: [BomStatus.DRAFT, BomStatus.ACTIVE],
          [BomStatus.ACTIVE]: [BomStatus.OBSOLETE],
          [BomStatus.OBSOLETE]: [],
        };
        if (!allowedTransitions[existing.status].includes(status)) {
          throw new DomainError(
            `A BOM cannot move from ${existing.status} to ${status}`,
            { status: 409, code: "INVALID_STATUS_TRANSITION" }
          );
        }
        const reason = optionalString(req.body.reason, "reason", 1_000);
        if (status === BomStatus.DRAFT && !reason) {
          throw new DomainError(
            "A reason is required when returning a BOM to draft",
            { code: "VALIDATION_ERROR" }
          );
        }

        if (
          (status === BomStatus.PENDING_APPROVAL ||
            status === BomStatus.ACTIVE) &&
          existing.components.length === 0
        ) {
          throw new DomainError(
            "A BOM with no components cannot be submitted or activated",
            { code: "BOM_EMPTY" }
          );
        }

        if (status === BomStatus.ACTIVE) {
          if (existing.createdById === userId) {
            throw new DomainError(
              "The author cannot approve their own BOM; another BOM manager must approve it",
              { status: 403, code: "SELF_APPROVAL_NOT_ALLOWED" }
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
            ...(status === BomStatus.DRAFT
              ? { approvedById: null, approvedAt: null }
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
          reason,
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
      if (bom.status !== BomStatus.DRAFT) {
        throw new DomainError(
          "Components can only be changed on a draft BOM; create a revision instead",
          {
            code: "BOM_FROZEN",
          }
        );
      }

      await assertNoCircularReference(bom.productId, componentProductId);

      const component = await prisma.$transaction(async tx => {
        await lockDraftBom(tx, bomId);
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
              parseOptionalInteger(
                req.body.lineNumber,
                "lineNumber",
                1,
                1_000_000
              ) ?? (highest?.lineNumber ?? 0) + 10,
            quantity: requirePositive(req.body.quantity, "quantity"),
            uomId: parseOptionalId(req.body.uomId),
            scrapPercent: requirePercentage(
              req.body.scrapPercent ?? 0,
              "scrapPercent"
            ),
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
      if (existing.bom.status !== BomStatus.DRAFT) {
        throw new DomainError(
          "Components can only be changed on a draft BOM; create a revision instead",
          {
            code: "BOM_FROZEN",
          }
        );
      }

      const updated = await prisma.$transaction(async tx => {
        await lockDraftBom(tx, existing.bomId);
        const component = await tx.bomComponent.update({
          where: { id: componentId },
          data: {
            ...(req.body.quantity !== undefined
              ? { quantity: requirePositive(req.body.quantity, "quantity") }
              : {}),
            ...(req.body.lineNumber !== undefined
              ? {
                  lineNumber: parseInteger(
                    req.body.lineNumber,
                    "lineNumber",
                    1,
                    1_000_000
                  ),
                }
              : {}),
            ...(req.body.uomId !== undefined
              ? { uomId: parseOptionalId(req.body.uomId) }
              : {}),
            ...(req.body.scrapPercent !== undefined
              ? {
                  scrapPercent: requirePercentage(
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
      if (existing.bom.status !== BomStatus.DRAFT) {
        throw new DomainError(
          "Components can only be changed on a draft BOM; create a revision instead",
          {
            code: "BOM_FROZEN",
          }
        );
      }

      await prisma.$transaction(async tx => {
        await lockDraftBom(tx, existing.bomId);
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
      if (component.bom.status !== BomStatus.DRAFT) {
        throw new DomainError(
          "Substitutes can only be changed on a draft BOM; create a revision instead",
          { code: "BOM_FROZEN" }
        );
      }
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
        await lockDraftBom(tx, component.bomId);
        const created = await tx.bomComponentSubstitute.create({
          data: {
            bomComponentId: componentId,
            substituteProductId,
            priority:
              parseOptionalInteger(req.body.priority, "priority", 1, 10_000) ??
              1,
            conversionFactor: requirePositive(
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

  async removeSubstitute(req: Request, res: Response) {
    const operation = "Remove component substitute";
    try {
      const userId = requireUserId(req);
      const substituteId = parseId(req.params.substituteId, "Substitute id");

      const existing = await prisma.bomComponentSubstitute.findUnique({
        where: { id: substituteId },
        include: {
          bomComponent: { include: { bom: true } },
          substituteProduct: { select: { code: true } },
        },
      });
      if (!existing) throw new NotFoundError("Component substitute");
      if (existing.bomComponent.bom.status !== BomStatus.DRAFT) {
        throw new DomainError(
          "Substitutes can only be changed on a draft BOM; create a revision instead",
          { code: "BOM_FROZEN" }
        );
      }

      await prisma.$transaction(async tx => {
        await lockDraftBom(tx, existing.bomComponent.bomId);
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
        ? requirePositive(String(req.query.quantity), "quantity")
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

      for (const [index, component] of components.entries()) {
        await assertNoCircularReference(
          bom.productId,
          parseId(
            String(component.componentProductId),
            `components[${index}].componentProductId`
          )
        );
      }

      const seen = new Set<number>();
      for (const [index, component] of components.entries()) {
        const productId = parseId(
          String(component.componentProductId),
          `components[${index}].componentProductId`
        );
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
        await lockDraftBom(tx, bomId);
        await tx.bomComponent.deleteMany({ where: { bomId } });

        for (const [index, component] of components.entries()) {
          await tx.bomComponent.create({
            data: {
              bomId,
              componentProductId: parseId(
                String(component.componentProductId),
                `components[${index}].componentProductId`
              ),
              lineNumber:
                parseOptionalInteger(
                  component.lineNumber,
                  `components[${index}].lineNumber`,
                  1,
                  1_000_000
                ) ?? (index + 1) * 10,
              quantity: requirePositive(
                component.quantity as string,
                `components[${index}].quantity`
              ),
              uomId: parseOptionalId(component.uomId),
              scrapPercent: requirePercentage(
                (component.scrapPercent as string) ?? 0,
                `components[${index}].scrapPercent`
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
