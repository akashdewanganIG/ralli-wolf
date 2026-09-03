import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { Prisma, AuditCategory, SupplierStatus } from "@prisma/client";
import {
  computeSupplierScorecard,
  getDeliveryWatchlist,
  rankSuppliers,
  snapshotSupplierPerformance,
  SCORE_WEIGHTS,
} from "../services/supplyChain/supplier-performance.service.js";
import { resolveSupplierPrice } from "../services/supplyChain/procurement.service.js";
import {
  nextDocumentNumber,
  SEQUENCE_KEYS,
} from "../services/supplyChain/numbering.service.js";
import { DomainError, NotFoundError } from "../services/supplyChain/errors.js";
import {
  requireNonNegative,
  requirePositive,
} from "../services/supplyChain/decimal.js";
import {
  handleSupplyChainError,
  optionalString,
  paginationMeta,
  parseBoolean,
  parseDate,
  parseDateRange,
  parseEnum,
  parseId,
  parseInteger,
  parseOptionalId,
  parseOptionalInteger,
  parsePagination,
  requireString,
  requireUserId,
} from "../utils/supply-chain-http.js";

export class SupplierController {
  async list(req: Request, res: Response) {
    const operation = "List suppliers";
    try {
      const pagination = parsePagination(req, 25);
      const status = parseEnum(SupplierStatus, req.query.status, "status");
      const search = optionalString(req.query.search);

      const where: Prisma.SupplierWhereInput = {
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
                { gstNumber: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [totalItems, suppliers] = await Promise.all([
        prisma.supplier.count({ where }),
        prisma.supplier.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { name: "asc" },
          include: {
            _count: {
              select: {
                purchaseOrders: true,
                supplierProducts: true,
                goodsReceiptNotes: true,
              },
            },
            performanceSnapshots: { orderBy: { computedAt: "desc" }, take: 1 },
          },
        }),
      ]);

      return res.json({
        data: suppliers,
        pagination: paginationMeta(totalItems, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async getById(req: Request, res: Response) {
    const operation = "Get supplier";
    try {
      const id = parseId(req.params.id, "Supplier id");
      const supplier = await prisma.supplier.findUnique({
        where: { id },
        include: {
          contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          performanceSnapshots: { orderBy: { periodEnd: "desc" }, take: 12 },
          _count: {
            select: {
              purchaseOrders: true,
              supplierProducts: true,
              goodsReceiptNotes: true,
            },
          },
        },
      });
      if (!supplier) throw new NotFoundError("Supplier");

      const recentOrders = await prisma.purchaseOrder.findMany({
        where: { supplierId: id },
        orderBy: { orderDate: "desc" },
        take: 10,
        select: {
          id: true,
          poNumber: true,
          status: true,
          orderDate: true,
          expectedDeliveryDate: true,
          grandTotal: true,
          currencyCode: true,
        },
      });

      return res.json({ data: { ...supplier, recentOrders } });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async create(req: Request, res: Response) {
    const operation = "Create supplier";
    try {
      const userId = requireUserId(req);

      const supplier = await prisma.$transaction(async tx => {
        const code =
          optionalString(req.body.code)?.toUpperCase() ??
          (await nextDocumentNumber(tx, SEQUENCE_KEYS.SUPPLIER));

        return tx.supplier.create({
          data: {
            code,
            name: requireString(req.body.name, "name"),
            legalName: optionalString(req.body.legalName),
            status:
              parseEnum(SupplierStatus, req.body.status, "status") ??
              SupplierStatus.DRAFT,
            email: optionalString(req.body.email),
            phone: optionalString(req.body.phone),
            countryCode: optionalString(req.body.countryCode) ?? "91",
            website: optionalString(req.body.website),
            gstNumber: optionalString(req.body.gstNumber),
            panNumber: optionalString(req.body.panNumber),
            addressLine1: optionalString(req.body.addressLine1),
            addressLine2: optionalString(req.body.addressLine2),
            city: optionalString(req.body.city),
            state: optionalString(req.body.state),
            postalCode: optionalString(req.body.postalCode),
            country: optionalString(req.body.country) ?? "India",
            currencyCode: optionalString(req.body.currencyCode) ?? "INR",
            paymentTerms: optionalString(req.body.paymentTerms),
            creditDays:
              parseOptionalInteger(
                req.body.creditDays,
                "creditDays",
                0,
                3_650
              ) ?? 0,
            incoterms: optionalString(req.body.incoterms),
            leadTimeDays:
              parseOptionalInteger(
                req.body.leadTimeDays,
                "leadTimeDays",
                0,
                3_650
              ) ?? 0,
            minOrderValue:
              req.body.minOrderValue === undefined ||
              req.body.minOrderValue === null ||
              req.body.minOrderValue === ""
                ? null
                : requireNonNegative(req.body.minOrderValue, "minOrderValue"),
            bankName: optionalString(req.body.bankName),
            bankAccountNumber: optionalString(req.body.bankAccountNumber),
            bankIfsc: optionalString(req.body.bankIfsc),
            notes: optionalString(req.body.notes),
            createdById: userId,
            ...(Array.isArray(req.body.contacts) && req.body.contacts.length > 0
              ? {
                  contacts: {
                    create: req.body.contacts.map(
                      (contact: Record<string, unknown>) => ({
                        name: requireString(contact.name, "contact.name"),
                        designation: optionalString(contact.designation),
                        email: optionalString(contact.email),
                        phone: optionalString(contact.phone),
                        isPrimary: parseBoolean(contact.isPrimary) ?? false,
                      })
                    ),
                  },
                }
              : {}),
          },
          include: { contacts: true },
        });
      });

      return res.status(201).json({ data: supplier });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async update(req: Request, res: Response) {
    const operation = "Update supplier";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "Supplier id");

      const existing = await prisma.supplier.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("Supplier");

      const status = parseEnum(SupplierStatus, req.body.status, "status");

      if (
        status === SupplierStatus.BLACKLISTED ||
        status === SupplierStatus.INACTIVE
      ) {
        const openOrders = await prisma.purchaseOrder.count({
          where: {
            supplierId: id,
            status: {
              in: [
                "APPROVED",
                "SENT",
                "ACKNOWLEDGED",
                "PARTIALLY_RECEIVED",
                "PENDING_APPROVAL",
              ],
            },
          },
        });
        if (openOrders > 0) {
          throw new DomainError(
            `${existing.name} has ${openOrders} open purchase order(s). Close or cancel them before setting the supplier to ${status}.`,
            { status: 409, code: "SUPPLIER_HAS_OPEN_ORDERS" }
          );
        }
      }

      const supplier = await prisma.supplier.update({
        where: { id },
        data: {
          ...(req.body.name !== undefined
            ? { name: requireString(req.body.name, "name") }
            : {}),
          ...(req.body.legalName !== undefined
            ? { legalName: optionalString(req.body.legalName) }
            : {}),
          ...(status ? { status } : {}),
          ...(req.body.email !== undefined
            ? { email: optionalString(req.body.email) }
            : {}),
          ...(req.body.phone !== undefined
            ? { phone: optionalString(req.body.phone) }
            : {}),
          ...(req.body.website !== undefined
            ? { website: optionalString(req.body.website) }
            : {}),
          ...(req.body.gstNumber !== undefined
            ? { gstNumber: optionalString(req.body.gstNumber) }
            : {}),
          ...(req.body.panNumber !== undefined
            ? { panNumber: optionalString(req.body.panNumber) }
            : {}),
          ...(req.body.addressLine1 !== undefined
            ? { addressLine1: optionalString(req.body.addressLine1) }
            : {}),
          ...(req.body.addressLine2 !== undefined
            ? { addressLine2: optionalString(req.body.addressLine2) }
            : {}),
          ...(req.body.city !== undefined
            ? { city: optionalString(req.body.city) }
            : {}),
          ...(req.body.state !== undefined
            ? { state: optionalString(req.body.state) }
            : {}),
          ...(req.body.postalCode !== undefined
            ? { postalCode: optionalString(req.body.postalCode) }
            : {}),
          ...(req.body.country !== undefined
            ? { country: optionalString(req.body.country) }
            : {}),
          ...(req.body.currencyCode !== undefined
            ? { currencyCode: optionalString(req.body.currencyCode) ?? "INR" }
            : {}),
          ...(req.body.paymentTerms !== undefined
            ? { paymentTerms: optionalString(req.body.paymentTerms) }
            : {}),
          ...(req.body.creditDays !== undefined
            ? {
                creditDays: parseInteger(
                  req.body.creditDays,
                  "creditDays",
                  0,
                  3_650
                ),
              }
            : {}),
          ...(req.body.incoterms !== undefined
            ? { incoterms: optionalString(req.body.incoterms) }
            : {}),
          ...(req.body.leadTimeDays !== undefined
            ? {
                leadTimeDays: parseInteger(
                  req.body.leadTimeDays,
                  "leadTimeDays",
                  0,
                  3_650
                ),
              }
            : {}),
          ...(req.body.minOrderValue !== undefined
            ? {
                minOrderValue:
                  req.body.minOrderValue === null ||
                  req.body.minOrderValue === ""
                    ? null
                    : requireNonNegative(
                        req.body.minOrderValue,
                        "minOrderValue"
                      ),
              }
            : {}),
          ...(req.body.bankName !== undefined
            ? { bankName: optionalString(req.body.bankName) }
            : {}),
          ...(req.body.bankAccountNumber !== undefined
            ? { bankAccountNumber: optionalString(req.body.bankAccountNumber) }
            : {}),
          ...(req.body.bankIfsc !== undefined
            ? { bankIfsc: optionalString(req.body.bankIfsc) }
            : {}),
          ...(req.body.notes !== undefined
            ? { notes: optionalString(req.body.notes) }
            : {}),
          ...(parseBoolean(req.body.isBlacklisted) !== undefined
            ? {
                isBlacklisted: parseBoolean(req.body.isBlacklisted) as boolean,
                blacklistReason: optionalString(req.body.blacklistReason),
              }
            : {}),
        },
        include: { contacts: true },
      });

      await prisma.auditLog.create({
        data: {
          entityType: "Supplier",
          entityId: id,
          changedBy: userId,
          action: "UPDATE",
          category: AuditCategory.PROCUREMENT,
          oldValues: { status: existing.status, name: existing.name },
          newValues: { status: supplier.status, name: supplier.name },
        },
      });

      return res.json({ data: supplier });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async addContact(req: Request, res: Response) {
    const operation = "Add supplier contact";
    try {
      const supplierId = parseId(req.params.id, "Supplier id");
      const isPrimary = parseBoolean(req.body.isPrimary) ?? false;

      const contact = await prisma.$transaction(async tx => {
        if (isPrimary) {
          await tx.supplierContact.updateMany({
            where: { supplierId, isPrimary: true },
            data: { isPrimary: false },
          });
        }
        return tx.supplierContact.create({
          data: {
            supplierId,
            name: requireString(req.body.name, "name"),
            designation: optionalString(req.body.designation),
            email: optionalString(req.body.email),
            phone: optionalString(req.body.phone),
            isPrimary,
          },
        });
      });

      return res.status(201).json({ data: contact });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async removeContact(req: Request, res: Response) {
    const operation = "Remove supplier contact";
    try {
      const contactId = parseId(req.params.contactId, "Contact id");
      await prisma.supplierContact.delete({ where: { id: contactId } });
      return res.status(204).send();
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async listCatalogue(req: Request, res: Response) {
    const operation = "List supplier catalogue";
    try {
      const supplierId = parseId(req.params.id, "Supplier id");
      const pagination = parsePagination(req, 50);
      const activeOnly = parseBoolean(req.query.activeOnly) ?? true;

      const where: Prisma.SupplierProductWhereInput = {
        supplierId,
        ...(activeOnly ? { isActive: true } : {}),
      };

      const [totalItems, entries] = await Promise.all([
        prisma.supplierProduct.count({ where }),
        prisma.supplierProduct.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: [{ isPreferred: "desc" }, { validFrom: "desc" }],
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
            priceTiers: { orderBy: { minQuantity: "asc" } },
          },
        }),
      ]);

      return res.json({
        data: entries,
        pagination: paginationMeta(totalItems, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async upsertCatalogueEntry(req: Request, res: Response) {
    const operation = "Save supplier price";
    try {
      const supplierId = parseId(req.params.id, "Supplier id");
      const productId = parseId(String(req.body.productId), "productId");
      const validFrom =
        parseDate(req.body.validFrom, "validFrom") ?? new Date();
      const validTo = parseDate(req.body.validTo, "validTo");
      if (validTo && validTo < validFrom) {
        throw new DomainError("validTo cannot be earlier than validFrom", {
          code: "VALIDATION_ERROR",
        });
      }

      const unitPrice = requireNonNegative(req.body.unitPrice, "unitPrice");
      const minOrderQuantity = requirePositive(
        req.body.minOrderQuantity ?? 1,
        "minOrderQuantity"
      );
      const packSize = requirePositive(req.body.packSize ?? 1, "packSize");
      const leadTimeDays =
        parseOptionalInteger(req.body.leadTimeDays, "leadTimeDays", 0, 3_650) ??
        0;

      const tiersProvided = req.body.priceTiers !== undefined;
      if (
        tiersProvided &&
        (!Array.isArray(req.body.priceTiers) ||
          req.body.priceTiers.length > 100)
      ) {
        throw new DomainError(
          "priceTiers must be an array of at most 100 rows",
          {
            code: "VALIDATION_ERROR",
          }
        );
      }
      const tierInput: unknown[] = Array.isArray(req.body.priceTiers)
        ? req.body.priceTiers
        : [];
      const tiers = tierInput.map((tier, index) => {
        if (!tier || typeof tier !== "object" || Array.isArray(tier)) {
          throw new DomainError(`priceTiers[${index}] must be an object`, {
            code: "VALIDATION_ERROR",
          });
        }
        const row = tier as Record<string, unknown>;
        return {
          minQuantity: requirePositive(
            row.minQuantity,
            `priceTiers[${index}].minQuantity`
          ),
          unitPrice: requireNonNegative(
            row.unitPrice,
            `priceTiers[${index}].unitPrice`
          ),
        };
      });
      const tierBreaks = new Set(
        tiers.map(tier => tier.minQuantity.toString())
      );
      if (tierBreaks.size !== tiers.length) {
        throw new DomainError("priceTiers cannot repeat a minimum quantity", {
          code: "VALIDATION_ERROR",
        });
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      if (!product) throw new NotFoundError("Product");
      if (!product.isPurchasable) {
        throw new DomainError(`${product.code} is not marked as purchasable`, {
          code: "NOT_PURCHASABLE",
        });
      }

      const isPreferred = parseBoolean(req.body.isPreferred) ?? false;
      const entry = await prisma.$transaction(async tx => {
        await tx.supplierProduct.updateMany({
          where: {
            supplierId,
            productId,
            isActive: true,
            validFrom: { lt: validFrom },
            validTo: null,
          },
          data: { validTo: new Date(validFrom.getTime() - 1000) },
        });

        if (isPreferred) {
          await tx.supplierProduct.updateMany({
            where: { productId, isPreferred: true },
            data: { isPreferred: false },
          });
        }

        const created = await tx.supplierProduct.upsert({
          where: {
            supplierId_productId_validFrom: {
              supplierId,
              productId,
              validFrom,
            },
          },
          create: {
            supplierId,
            productId,
            supplierSku: optionalString(req.body.supplierSku),
            unitPrice,
            currencyCode: optionalString(req.body.currencyCode) ?? "INR",
            minOrderQuantity,
            packSize,
            leadTimeDays,
            validFrom,
            validTo,
            isPreferred,
            isActive: parseBoolean(req.body.isActive) ?? true,
          },
          update: {
            supplierSku: optionalString(req.body.supplierSku),
            unitPrice,
            currencyCode: optionalString(req.body.currencyCode) ?? "INR",
            minOrderQuantity,
            packSize,
            leadTimeDays,
            validTo,
            isPreferred,
            ...(parseBoolean(req.body.isActive) !== undefined
              ? { isActive: parseBoolean(req.body.isActive) }
              : {}),
          },
        });

        if (tiersProvided) {
          await tx.supplierPriceTier.deleteMany({
            where: { supplierProductId: created.id },
          });
          for (const tier of tiers) {
            await tx.supplierPriceTier.create({
              data: {
                supplierProductId: created.id,
                minQuantity: tier.minQuantity,
                unitPrice: tier.unitPrice,
              },
            });
          }
        }

        return tx.supplierProduct.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            product: { select: { id: true, code: true, name: true } },
            priceTiers: { orderBy: { minQuantity: "asc" } },
          },
        });
      });

      return res.status(201).json({ data: entry });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async removeCatalogueEntry(req: Request, res: Response) {
    const operation = "Remove supplier price";
    try {
      const entryId = parseId(req.params.entryId, "Catalogue entry id");
      await prisma.supplierProduct.update({
        where: { id: entryId },
        data: { isActive: false, validTo: new Date() },
      });
      return res.status(204).send();
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async priceComparison(req: Request, res: Response) {
    const operation = "Compare supplier prices";
    try {
      const productId = parseId(req.params.productId, "Product id");
      const quantity = requirePositive(
        String(req.query.quantity ?? "1"),
        "quantity"
      );
      const now = new Date();

      const entries = await prisma.supplierProduct.findMany({
        where: {
          productId,
          isActive: true,
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gte: now } }],
          supplier: {
            status: { in: [SupplierStatus.ACTIVE, SupplierStatus.ON_HOLD] },
          },
        },
        include: {
          supplier: {
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
              leadTimeDays: true,
              paymentTerms: true,
            },
          },
          priceTiers: { orderBy: { minQuantity: "desc" } },
        },
      });

      const rows = await Promise.all(
        entries.map(async entry => {
          const resolved = await resolveSupplierPrice({
            supplierId: entry.supplierId,
            productId,
            quantity,
            onDate: now,
          });
          const unitPrice = resolved?.unitPrice ?? entry.unitPrice;
          return {
            supplier: entry.supplier,
            supplierSku: entry.supplierSku,
            unitPrice,
            priceSource: resolved?.source ?? "CATALOGUE",
            currencyCode: entry.currencyCode,
            minOrderQuantity: entry.minOrderQuantity,
            packSize: entry.packSize,
            leadTimeDays: entry.leadTimeDays || entry.supplier.leadTimeDays,
            isPreferred: entry.isPreferred,
            extendedPrice: unitPrice.times(quantity).toDecimalPlaces(2),
            meetsMinimumOrder: quantity.greaterThanOrEqualTo(
              entry.minOrderQuantity
            ),
            priceTiers: entry.priceTiers,
          };
        })
      );

      rows.sort((a, b) => a.extendedPrice.comparedTo(b.extendedPrice));

      return res.json({ data: { productId, quantity, suppliers: rows } });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async performance(req: Request, res: Response) {
    const operation = "Supplier performance";
    try {
      const id = parseId(req.params.id, "Supplier id");
      const { from, to } = parseDateRange(req, 365);

      const [scorecard, history] = await Promise.all([
        computeSupplierScorecard(id, from, to),
        prisma.supplierPerformance.findMany({
          where: { supplierId: id },
          orderBy: { periodEnd: "desc" },
          take: 12,
        }),
      ]);

      return res.json({ data: { scorecard, history, weights: SCORE_WEIGHTS } });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async snapshotPerformance(req: Request, res: Response) {
    const operation = "Snapshot supplier performance";
    try {
      const id = parseId(req.params.id, "Supplier id");
      const { from, to } = parseDateRange(req, 30);
      const snapshot = await snapshotSupplierPerformance(id, from, to);
      return res.status(201).json({ data: snapshot });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async scorecards(req: Request, res: Response) {
    const operation = "Supplier scorecards";
    try {
      const { from, to } = parseDateRange(req, 365);
      const limit = parseOptionalId(req.query.limit) ?? 50;
      const ranked = await rankSuppliers(from, to, limit);
      return res.json({
        data: {
          period: { from, to },
          weights: SCORE_WEIGHTS,
          suppliers: ranked,
        },
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async deliveryWatchlist(req: Request, res: Response) {
    const operation = "Delivery watchlist";
    try {
      const rows = await getDeliveryWatchlist({
        warehouseId: parseOptionalId(req.query.warehouseId),
        daysAhead: parseOptionalId(req.query.daysAhead) ?? 7,
      });
      return res.json({
        data: {
          total: rows.length,
          overdue: rows.filter(row => row.isOverdue).length,
          rows,
        },
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }
}
