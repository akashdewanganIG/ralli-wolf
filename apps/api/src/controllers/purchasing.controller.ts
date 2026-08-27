import { Request, Response } from "express";
import { prisma } from "@repo/db";
import {
  Prisma,
  ApprovalStatus,
  ApprovalTargetObject,
  AuditCategory,
  PurchaseOrderLineStatus,
  PurchaseOrderStatus,
  PurchaseRequisitionStatus,
  SupplierStatus,
  UserRole,
} from "@prisma/client";
import {
  calculatePurchaseLines,
  recalculatePurchaseOrderTotals,
} from "../services/supplyChain/procurement.service.js";
import {
  nextDocumentNumber,
  SEQUENCE_KEYS,
} from "../services/supplyChain/numbering.service.js";
import { DomainError, NotFoundError } from "../services/supplyChain/errors.js";
import {
  ZERO,
  roundMoney,
  roundQuantity,
  toDecimal,
} from "../services/supplyChain/decimal.js";
import { createNotification } from "./notification.controller.js";
import { emailService } from "../services/email.service.js";
import { buildFullName } from "../utils/nameHelpers.js";
import {
  handleSupplyChainError,
  optionalString,
  paginationMeta,
  parseDate,
  parseEnum,
  parseId,
  parseOptionalId,
  parsePagination,
  requireArray,
  requireUserId,
} from "../utils/supplyChainHttp.js";

const PO_INCLUDE = {
  supplier: {
    select: {
      id: true,
      code: true,
      name: true,
      email: true,
      paymentTerms: true,
      leadTimeDays: true,
    },
  },
  warehouse: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
  requisition: { select: { id: true, requisitionNumber: true } },
} as const;

export class PurchasingController {
  // -------------------------------------------------------- requisitions

  /** GET /api/purchase-requisitions */
  async listRequisitions(req: Request, res: Response) {
    const operation = "List purchase requisitions";
    try {
      const pagination = parsePagination(req, 25);
      const status = parseEnum(
        PurchaseRequisitionStatus,
        req.query.status,
        "status"
      );
      const warehouseId = parseOptionalId(req.query.warehouseId);
      const origin = optionalString(req.query.origin);

      const where: Prisma.PurchaseRequisitionWhereInput = {
        ...(status ? { status } : {}),
        ...(warehouseId ? { warehouseId } : {}),
        ...(origin ? { origin } : {}),
      };

      const [totalItems, requisitions] = await Promise.all([
        prisma.purchaseRequisition.count({ where }),
        prisma.purchaseRequisition.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { createdAt: "desc" },
          include: {
            warehouse: { select: { id: true, code: true, name: true } },
            suggestedSupplier: { select: { id: true, code: true, name: true } },
            requestedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
            _count: { select: { lines: true, purchaseOrders: true } },
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

  /** GET /api/purchase-requisitions/:id */
  async getRequisition(req: Request, res: Response) {
    const operation = "Get purchase requisition";
    try {
      const id = parseId(req.params.id, "Requisition id");
      const requisition = await prisma.purchaseRequisition.findUnique({
        where: { id },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          suggestedSupplier: { select: { id: true, code: true, name: true } },
          requestedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
          purchaseOrders: {
            select: {
              id: true,
              poNumber: true,
              status: true,
              grandTotal: true,
            },
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
      if (!requisition) throw new NotFoundError("Purchase requisition");
      return res.json({ data: requisition });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** POST /api/purchase-requisitions */
  async createRequisition(req: Request, res: Response) {
    const operation = "Create purchase requisition";
    try {
      const userId = requireUserId(req);
      const warehouseId = parseId(String(req.body.warehouseId), "warehouseId");
      const lines = requireArray<Record<string, unknown>>(
        req.body.lines,
        "lines"
      );

      const requisition = await prisma.$transaction(async tx => {
        const requisitionNumber = await nextDocumentNumber(
          tx,
          SEQUENCE_KEYS.PURCHASE_REQUISITION
        );

        let estimatedValue = ZERO;
        const lineData = [];

        for (const [index, line] of lines.entries()) {
          const productId = parseId(
            String(line.productId),
            `lines[${index}].productId`
          );
          const quantity = toDecimal(
            line.quantity as string,
            `lines[${index}].quantity`
          );
          const unitPrice = line.estimatedUnitPrice
            ? toDecimal(line.estimatedUnitPrice as string, "estimatedUnitPrice")
            : ZERO;

          estimatedValue = estimatedValue.plus(quantity.times(unitPrice));
          lineData.push({
            productId,
            quantity: roundQuantity(quantity),
            estimatedUnitPrice: unitPrice,
            uomId: parseOptionalId(line.uomId),
            requiredByDate: parseDate(line.requiredByDate, "requiredByDate"),
            notes: optionalString(line.notes),
          });
        }

        return tx.purchaseRequisition.create({
          data: {
            requisitionNumber,
            warehouseId,
            origin: optionalString(req.body.origin) ?? "MANUAL",
            status: PurchaseRequisitionStatus.DRAFT,
            requiredByDate: parseDate(
              req.body.requiredByDate,
              "requiredByDate"
            ),
            suggestedSupplierId: parseOptionalId(req.body.suggestedSupplierId),
            estimatedValue: roundMoney(estimatedValue),
            justification: optionalString(req.body.justification),
            requestedById: userId,
            lines: { create: lineData },
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
   * PATCH /api/purchase-requisitions/:id/status
   * Approve, reject or cancel a requisition.
   */
  async setRequisitionStatus(req: Request, res: Response) {
    const operation = "Update requisition status";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "Requisition id");
      const status = parseEnum(
        PurchaseRequisitionStatus,
        req.body.status,
        "status",
        true
      ) as PurchaseRequisitionStatus;

      const existing = await prisma.purchaseRequisition.findUnique({
        where: { id },
      });
      if (!existing) throw new NotFoundError("Purchase requisition");
      if (existing.status === PurchaseRequisitionStatus.CONVERTED) {
        throw new DomainError(
          "A converted requisition can no longer change status",
          { code: "ALREADY_CONVERTED" }
        );
      }

      const requisition = await prisma.purchaseRequisition.update({
        where: { id },
        data: {
          status,
          ...(status === PurchaseRequisitionStatus.APPROVED
            ? { approvedById: userId, approvedAt: new Date() }
            : {}),
          ...(status === PurchaseRequisitionStatus.REJECTED
            ? { rejectionReason: optionalString(req.body.reason) }
            : {}),
        },
      });

      return res.json({ data: requisition });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /**
   * POST /api/purchase-requisitions/:id/convert
   * Turn an approved requisition into a purchase order. Lines already ordered
   * are skipped, so converting twice cannot double-order.
   */
  async convertRequisition(req: Request, res: Response) {
    const operation = "Convert requisition to purchase order";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "Requisition id");
      const supplierId = parseId(String(req.body.supplierId), "supplierId");

      const order = await prisma.$transaction(async tx => {
        const requisition = await tx.purchaseRequisition.findUnique({
          where: { id },
          include: {
            lines: { include: { product: { select: { code: true } } } },
          },
        });
        if (!requisition) throw new NotFoundError("Purchase requisition");
        if (
          requisition.status !== PurchaseRequisitionStatus.APPROVED &&
          requisition.status !== PurchaseRequisitionStatus.PARTIALLY_CONVERTED
        ) {
          throw new DomainError(
            `Only an approved requisition can be converted; this one is ${requisition.status.toLowerCase()}`,
            { code: "REQUISITION_NOT_APPROVED" }
          );
        }

        const supplier = await tx.supplier.findUnique({
          where: { id: supplierId },
        });
        if (!supplier) throw new NotFoundError("Supplier");
        if (
          supplier.status === SupplierStatus.BLACKLISTED ||
          supplier.isBlacklisted
        ) {
          throw new DomainError(
            `${supplier.name} is blacklisted and cannot receive purchase orders`,
            {
              status: 409,
              code: "SUPPLIER_BLACKLISTED",
            }
          );
        }

        const outstanding = requisition.lines.filter(line =>
          line.quantity.greaterThan(line.orderedQuantity)
        );
        if (outstanding.length === 0) {
          throw new DomainError(
            "Every line on this requisition has already been ordered",
            {
              code: "NOTHING_TO_CONVERT",
            }
          );
        }

        const priced = await calculatePurchaseLines(
          {
            supplierId,
            lines: outstanding.map(line => ({
              productId: line.productId,
              quantity: line.quantity.minus(line.orderedQuantity),
              unitPrice: line.estimatedUnitPrice.greaterThan(0)
                ? line.estimatedUnitPrice
                : null,
              uomId: line.uomId,
              expectedDate: line.requiredByDate,
              requisitionLineId: line.id,
              taxPercent: req.body.taxPercent ?? null,
            })),
          },
          tx
        );

        const poNumber = await nextDocumentNumber(
          tx,
          SEQUENCE_KEYS.PURCHASE_ORDER
        );
        const shippingAmount = req.body.shippingAmount
          ? toDecimal(req.body.shippingAmount, "shippingAmount")
          : ZERO;

        const created = await tx.purchaseOrder.create({
          data: {
            poNumber,
            supplierId,
            warehouseId: requisition.warehouseId,
            requisitionId: requisition.id,
            status: PurchaseOrderStatus.DRAFT,
            orderDate: new Date(),
            expectedDeliveryDate:
              parseDate(
                req.body.expectedDeliveryDate,
                "expectedDeliveryDate"
              ) ?? requisition.requiredByDate,
            currencyCode: supplier.currencyCode,
            subtotal: priced.subtotal,
            discountAmount: priced.discountAmount,
            taxAmount: priced.taxAmount,
            shippingAmount,
            grandTotal: roundMoney(priced.netTotal.plus(shippingAmount)),
            paymentTerms: supplier.paymentTerms,
            incoterms: supplier.incoterms,
            notes: optionalString(req.body.notes),
            createdById: userId,
            lines: {
              create: priced.lines.map(line => ({
                productId: line.productId,
                requisitionLineId: line.requisitionLineId,
                lineNumber: line.lineNumber,
                description: line.description,
                quantity: line.quantity,
                uomId: line.uomId,
                unitPrice: line.unitPrice,
                discountPercent: line.discountPercent,
                taxPercent: line.taxPercent,
                taxAmount: line.taxAmount,
                lineTotal: line.lineTotal,
                expectedDate: line.expectedDate,
              })),
            },
          },
          include: PO_INCLUDE,
        });

        for (const line of priced.lines) {
          if (!line.requisitionLineId) continue;
          const requisitionLine = requisition.lines.find(
            entry => entry.id === line.requisitionLineId
          );
          if (!requisitionLine) continue;
          await tx.purchaseRequisitionLine.update({
            where: { id: line.requisitionLineId },
            data: {
              orderedQuantity: roundQuantity(
                requisitionLine.orderedQuantity.plus(line.quantity)
              ),
            },
          });
        }

        const refreshed = await tx.purchaseRequisitionLine.findMany({
          where: { requisitionId: id },
        });
        const fullyConverted = refreshed.every(line =>
          line.orderedQuantity.greaterThanOrEqualTo(line.quantity)
        );

        await tx.purchaseRequisition.update({
          where: { id },
          data: {
            status: fullyConverted
              ? PurchaseRequisitionStatus.CONVERTED
              : PurchaseRequisitionStatus.PARTIALLY_CONVERTED,
          },
        });

        return created;
      });

      return res.status(201).json({ data: order });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  // ------------------------------------------------------- purchase orders

  /** GET /api/purchase-orders */
  async listOrders(req: Request, res: Response) {
    const operation = "List purchase orders";
    try {
      const pagination = parsePagination(req, 25);
      const status = parseEnum(PurchaseOrderStatus, req.query.status, "status");
      const supplierId = parseOptionalId(req.query.supplierId);
      const warehouseId = parseOptionalId(req.query.warehouseId);
      const search = optionalString(req.query.search);

      const where: Prisma.PurchaseOrderWhereInput = {
        ...(status ? { status } : {}),
        ...(supplierId ? { supplierId } : {}),
        ...(warehouseId ? { warehouseId } : {}),
        ...(search
          ? {
              OR: [
                { poNumber: { contains: search, mode: "insensitive" } },
                {
                  supplier: { name: { contains: search, mode: "insensitive" } },
                },
              ],
            }
          : {}),
      };

      const [totalItems, orders] = await Promise.all([
        prisma.purchaseOrder.count({ where }),
        prisma.purchaseOrder.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { orderDate: "desc" },
          include: {
            ...PO_INCLUDE,
            _count: { select: { lines: true, receipts: true } },
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

  /** GET /api/purchase-orders/:id */
  async getOrder(req: Request, res: Response) {
    const operation = "Get purchase order";
    try {
      const id = parseId(req.params.id, "Purchase order id");
      const order = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          ...PO_INCLUDE,
          lines: {
            orderBy: { lineNumber: "asc" },
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
          receipts: {
            orderBy: { receivedDate: "desc" },
            select: {
              id: true,
              grnNumber: true,
              status: true,
              receivedDate: true,
              totalReceivedQuantity: true,
              totalAcceptedQuantity: true,
              totalRejectedQuantity: true,
              isOnTime: true,
            },
          },
        },
      });
      if (!order) throw new NotFoundError("Purchase order");

      const approvals = await prisma.approvalProcess.findMany({
        where: {
          targetObjectName: ApprovalTargetObject.PURCHASE_ORDER,
          targetRecordId: id,
        },
        orderBy: { createdAt: "desc" },
        include: {
          requestedTo: {
            select: { id: true, firstName: true, lastName: true },
          },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return res.json({ data: { ...order, approvals } });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** POST /api/purchase-orders */
  async createOrder(req: Request, res: Response) {
    const operation = "Create purchase order";
    try {
      const userId = requireUserId(req);
      const supplierId = parseId(String(req.body.supplierId), "supplierId");
      const warehouseId = parseId(String(req.body.warehouseId), "warehouseId");
      const lines = requireArray<Record<string, unknown>>(
        req.body.lines,
        "lines"
      );

      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
      });
      if (!supplier) throw new NotFoundError("Supplier");
      if (
        supplier.isBlacklisted ||
        supplier.status === SupplierStatus.BLACKLISTED
      ) {
        throw new DomainError(
          `${supplier.name} is blacklisted and cannot receive purchase orders`,
          {
            status: 409,
            code: "SUPPLIER_BLACKLISTED",
          }
        );
      }
      if (supplier.status === SupplierStatus.INACTIVE) {
        throw new DomainError(`${supplier.name} is inactive`, {
          code: "SUPPLIER_INACTIVE",
        });
      }

      const orderDate =
        parseDate(req.body.orderDate, "orderDate") ?? new Date();

      const order = await prisma.$transaction(async tx => {
        const priced = await calculatePurchaseLines(
          {
            supplierId,
            orderDate,
            lines: lines.map((line, index) => ({
              productId: parseId(
                String(line.productId),
                `lines[${index}].productId`
              ),
              quantity: line.quantity as string,
              unitPrice: (line.unitPrice as string) ?? null,
              discountPercent: (line.discountPercent as string) ?? null,
              taxPercent: (line.taxPercent as string) ?? null,
              uomId: parseOptionalId(line.uomId),
              description: optionalString(line.description),
              expectedDate: parseDate(line.expectedDate, "expectedDate"),
            })),
          },
          tx
        );

        const shippingAmount = req.body.shippingAmount
          ? toDecimal(req.body.shippingAmount, "shippingAmount")
          : ZERO;
        const grandTotal = roundMoney(priced.netTotal.plus(shippingAmount));

        if (
          supplier.minOrderValue &&
          grandTotal.lessThan(supplier.minOrderValue)
        ) {
          throw new DomainError(
            `${supplier.name} has a minimum order value of ${supplier.minOrderValue.toFixed(2)}; this order totals ${grandTotal.toFixed(2)}`,
            { code: "BELOW_MINIMUM_ORDER_VALUE" }
          );
        }

        const poNumber = await nextDocumentNumber(
          tx,
          SEQUENCE_KEYS.PURCHASE_ORDER,
          orderDate
        );

        // If the caller gave no expected date, derive one from the supplier's
        // stated lead time rather than leaving delivery tracking blind.
        let expectedDeliveryDate = parseDate(
          req.body.expectedDeliveryDate,
          "expectedDeliveryDate"
        );
        if (!expectedDeliveryDate && supplier.leadTimeDays > 0) {
          expectedDeliveryDate = new Date(orderDate);
          expectedDeliveryDate.setUTCDate(
            expectedDeliveryDate.getUTCDate() + supplier.leadTimeDays
          );
        }

        return tx.purchaseOrder.create({
          data: {
            poNumber,
            supplierId,
            warehouseId,
            requisitionId: parseOptionalId(req.body.requisitionId),
            status: PurchaseOrderStatus.DRAFT,
            orderDate,
            expectedDeliveryDate,
            promisedDate: parseDate(req.body.promisedDate, "promisedDate"),
            currencyCode:
              optionalString(req.body.currencyCode) ?? supplier.currencyCode,
            exchangeRate: req.body.exchangeRate
              ? toDecimal(req.body.exchangeRate, "exchangeRate")
              : 1,
            subtotal: priced.subtotal,
            discountAmount: priced.discountAmount,
            taxAmount: priced.taxAmount,
            shippingAmount,
            grandTotal,
            paymentTerms:
              optionalString(req.body.paymentTerms) ?? supplier.paymentTerms,
            incoterms: optionalString(req.body.incoterms) ?? supplier.incoterms,
            shipToAddress: optionalString(req.body.shipToAddress),
            notes: optionalString(req.body.notes),
            internalNotes: optionalString(req.body.internalNotes),
            createdById: userId,
            lines: {
              create: priced.lines.map(line => ({
                productId: line.productId,
                lineNumber: line.lineNumber,
                description: line.description,
                quantity: line.quantity,
                uomId: line.uomId,
                unitPrice: line.unitPrice,
                discountPercent: line.discountPercent,
                taxPercent: line.taxPercent,
                taxAmount: line.taxAmount,
                lineTotal: line.lineTotal,
                expectedDate: line.expectedDate,
              })),
            },
          },
          include: PO_INCLUDE,
        });
      });

      return res.status(201).json({ data: order });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** PUT /api/purchase-orders/:id — draft orders only. */
  async updateOrder(req: Request, res: Response) {
    const operation = "Update purchase order";
    try {
      const id = parseId(req.params.id, "Purchase order id");
      const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("Purchase order");
      if (
        existing.status !== PurchaseOrderStatus.DRAFT &&
        existing.status !== PurchaseOrderStatus.REJECTED
      ) {
        throw new DomainError(
          `Only a draft or rejected purchase order can be edited; this one is ${existing.status.toLowerCase()}`,
          { code: "PO_NOT_EDITABLE" }
        );
      }

      const order = await prisma.$transaction(async tx => {
        await tx.purchaseOrder.update({
          where: { id },
          data: {
            ...(req.body.expectedDeliveryDate !== undefined
              ? {
                  expectedDeliveryDate: parseDate(
                    req.body.expectedDeliveryDate,
                    "expectedDeliveryDate"
                  ),
                }
              : {}),
            ...(req.body.promisedDate !== undefined
              ? {
                  promisedDate: parseDate(
                    req.body.promisedDate,
                    "promisedDate"
                  ),
                }
              : {}),
            ...(req.body.paymentTerms !== undefined
              ? { paymentTerms: optionalString(req.body.paymentTerms) }
              : {}),
            ...(req.body.incoterms !== undefined
              ? { incoterms: optionalString(req.body.incoterms) }
              : {}),
            ...(req.body.shipToAddress !== undefined
              ? { shipToAddress: optionalString(req.body.shipToAddress) }
              : {}),
            ...(req.body.notes !== undefined
              ? { notes: optionalString(req.body.notes) }
              : {}),
            ...(req.body.internalNotes !== undefined
              ? { internalNotes: optionalString(req.body.internalNotes) }
              : {}),
            ...(req.body.shippingAmount !== undefined
              ? {
                  shippingAmount: toDecimal(
                    req.body.shippingAmount,
                    "shippingAmount"
                  ),
                }
              : {}),
          },
        });

        if (Array.isArray(req.body.lines)) {
          const priced = await calculatePurchaseLines(
            {
              supplierId: existing.supplierId,
              orderDate: existing.orderDate,
              lines: req.body.lines.map(
                (line: Record<string, unknown>, index: number) => ({
                  productId: parseId(
                    String(line.productId),
                    `lines[${index}].productId`
                  ),
                  quantity: line.quantity as string,
                  unitPrice: (line.unitPrice as string) ?? null,
                  discountPercent: (line.discountPercent as string) ?? null,
                  taxPercent: (line.taxPercent as string) ?? null,
                  uomId: parseOptionalId(line.uomId),
                  description: optionalString(line.description),
                  expectedDate: parseDate(line.expectedDate, "expectedDate"),
                })
              ),
            },
            tx
          );

          await tx.purchaseOrderLine.deleteMany({
            where: { purchaseOrderId: id },
          });
          for (const line of priced.lines) {
            await tx.purchaseOrderLine.create({
              data: {
                purchaseOrderId: id,
                productId: line.productId,
                lineNumber: line.lineNumber,
                description: line.description,
                quantity: line.quantity,
                uomId: line.uomId,
                unitPrice: line.unitPrice,
                discountPercent: line.discountPercent,
                taxPercent: line.taxPercent,
                taxAmount: line.taxAmount,
                lineTotal: line.lineTotal,
                expectedDate: line.expectedDate,
              },
            });
          }
        }

        await recalculatePurchaseOrderTotals(tx, id);
        return tx.purchaseOrder.findUniqueOrThrow({
          where: { id },
          include: PO_INCLUDE,
        });
      });

      return res.json({ data: order });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /**
   * POST /api/purchase-orders/:id/submit
   * Route the order for approval using the CRM's existing approval process,
   * so purchase approvals land in the same queue, notifications and audit
   * trail as sales approvals.
   */
  async submitForApproval(req: Request, res: Response) {
    const operation = "Submit purchase order for approval";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "Purchase order id");
      const requestedToId = parseId(
        String(req.body.requestedToId),
        "requestedToId"
      );

      const approver = await prisma.user.findUnique({
        where: { id: requestedToId },
      });
      if (!approver) throw new NotFoundError("Approver");
      if (approver.role === UserRole.SALES) {
        throw new DomainError("The approver must be an ADMIN", {
          code: "INVALID_APPROVER",
        });
      }

      const result = await prisma.$transaction(async tx => {
        const order = await tx.purchaseOrder.findUnique({
          where: { id },
          include: { lines: true, supplier: { select: { name: true } } },
        });
        if (!order) throw new NotFoundError("Purchase order");
        if (
          order.status !== PurchaseOrderStatus.DRAFT &&
          order.status !== PurchaseOrderStatus.REJECTED
        ) {
          throw new DomainError(
            `Only a draft or rejected purchase order can be submitted; this one is ${order.status.toLowerCase()}`,
            { code: "PO_NOT_SUBMITTABLE" }
          );
        }
        if (order.lines.length === 0) {
          throw new DomainError(
            "A purchase order with no lines cannot be submitted",
            { code: "PO_EMPTY" }
          );
        }

        const pending = await tx.approvalProcess.findFirst({
          where: {
            targetObjectName: ApprovalTargetObject.PURCHASE_ORDER,
            targetRecordId: id,
            status: ApprovalStatus.PENDING,
          },
        });
        if (pending) {
          throw new DomainError(
            "This purchase order already has a pending approval",
            {
              status: 409,
              code: "APPROVAL_EXISTS",
            }
          );
        }

        const approval = await tx.approvalProcess.create({
          data: {
            targetObjectName: ApprovalTargetObject.PURCHASE_ORDER,
            targetRecordId: id,
            requestedToId,
            createdById: userId,
            comment: optionalString(req.body.comment),
          },
        });

        await tx.purchaseOrder.update({
          where: { id },
          data: { status: PurchaseOrderStatus.PENDING_APPROVAL },
        });

        await tx.auditLog.create({
          data: {
            entityType: "PurchaseOrder",
            entityId: id,
            changedBy: userId,
            action: "SUBMIT_FOR_APPROVAL",
            category: AuditCategory.PROCUREMENT,
            newValues: {
              status: PurchaseOrderStatus.PENDING_APPROVAL,
              approvalId: approval.id,
            },
          },
        });

        return { approval, order };
      });

      const requester = await prisma.user.findUnique({ where: { id: userId } });
      createNotification({
        userId: requestedToId,
        type: "APPROVAL_REQUESTED",
        title: `Approval Requested — Purchase Order ${result.order.poNumber}`,
        message: `${buildFullName(requester?.firstName ?? null, requester?.lastName ?? null)} submitted a ${result.order.grandTotal.toFixed(2)} ${result.order.currencyCode} order for ${result.order.supplier.name}.`,
        link: `/purchasing/orders/${id}`,
      }).catch(error =>
        console.error("[Purchasing] Failed to create notification:", error)
      );

      return res.status(201).json({ data: result.approval });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /**
   * PATCH /api/purchase-orders/:id/status
   * Drive the order through its lifecycle. Each transition is checked, so a
   * cancelled order cannot be sent and a received order cannot be reopened.
   */
  async setOrderStatus(req: Request, res: Response) {
    const operation = "Update purchase order status";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "Purchase order id");
      const status = parseEnum(
        PurchaseOrderStatus,
        req.body.status,
        "status",
        true
      ) as PurchaseOrderStatus;

      const allowedTransitions: Record<
        PurchaseOrderStatus,
        PurchaseOrderStatus[]
      > = {
        DRAFT: [
          PurchaseOrderStatus.PENDING_APPROVAL,
          PurchaseOrderStatus.APPROVED,
          PurchaseOrderStatus.CANCELLED,
        ],
        PENDING_APPROVAL: [
          PurchaseOrderStatus.APPROVED,
          PurchaseOrderStatus.REJECTED,
          PurchaseOrderStatus.CANCELLED,
        ],
        APPROVED: [PurchaseOrderStatus.SENT, PurchaseOrderStatus.CANCELLED],
        REJECTED: [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.CANCELLED],
        SENT: [PurchaseOrderStatus.ACKNOWLEDGED, PurchaseOrderStatus.CANCELLED],
        ACKNOWLEDGED: [
          PurchaseOrderStatus.PARTIALLY_RECEIVED,
          PurchaseOrderStatus.RECEIVED,
          PurchaseOrderStatus.CANCELLED,
        ],
        PARTIALLY_RECEIVED: [
          PurchaseOrderStatus.RECEIVED,
          PurchaseOrderStatus.CLOSED,
          PurchaseOrderStatus.CANCELLED,
        ],
        RECEIVED: [PurchaseOrderStatus.CLOSED],
        CLOSED: [],
        CANCELLED: [],
      };

      const order = await prisma.$transaction(async tx => {
        const existing = await tx.purchaseOrder.findUnique({
          where: { id },
          include: { lines: true },
        });
        if (!existing) throw new NotFoundError("Purchase order");

        if (!allowedTransitions[existing.status].includes(status)) {
          throw new DomainError(
            `A purchase order cannot move from ${existing.status} to ${status}`,
            { status: 409, code: "INVALID_STATUS_TRANSITION" }
          );
        }

        if (status === PurchaseOrderStatus.CANCELLED) {
          const received = existing.lines.some(line =>
            line.receivedQuantity.greaterThan(0)
          );
          if (received) {
            throw new DomainError(
              "Goods have already been received against this order; close it instead of cancelling",
              { status: 409, code: "PO_PARTIALLY_RECEIVED" }
            );
          }
        }

        const updated = await tx.purchaseOrder.update({
          where: { id },
          data: {
            status,
            ...(status === PurchaseOrderStatus.APPROVED
              ? { approvedById: userId, approvedAt: new Date() }
              : {}),
            ...(status === PurchaseOrderStatus.SENT
              ? { sentAt: new Date() }
              : {}),
            ...(status === PurchaseOrderStatus.ACKNOWLEDGED
              ? { acknowledgedAt: new Date() }
              : {}),
            ...(status === PurchaseOrderStatus.CLOSED
              ? { closedAt: new Date() }
              : {}),
            ...(status === PurchaseOrderStatus.CANCELLED
              ? { cancellationReason: optionalString(req.body.reason) }
              : {}),
          },
          include: PO_INCLUDE,
        });

        if (status === PurchaseOrderStatus.CANCELLED) {
          await tx.purchaseOrderLine.updateMany({
            where: { purchaseOrderId: id },
            data: { status: PurchaseOrderLineStatus.CANCELLED },
          });
        }

        await tx.auditLog.create({
          data: {
            entityType: "PurchaseOrder",
            entityId: id,
            changedBy: userId,
            action: "STATUS_CHANGE",
            category: AuditCategory.PROCUREMENT,
            oldValues: { status: existing.status },
            newValues: { status },
          },
        });

        return updated;
      });

      // Sending the order to the supplier happens after the transaction, not
      // inside it: a mail failure must not roll back a status change that has
      // already been decided, and the supplier can be re-sent to.
      if (status === PurchaseOrderStatus.SENT) {
        void this.deliverPurchaseOrder(order.id).catch(error =>
          console.error("[Purchasing] Sending PO to supplier failed:", error)
        );
      }

      return res.json({ data: order });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /**
   * Emails a purchase order to its supplier and tells the raiser it went.
   *
   * Until this existed an order could be marked SENT without anything leaving
   * the building: the status said the supplier had it, and the supplier did
   * not. Never throws — the caller has already committed the status change.
   */
  private async deliverPurchaseOrder(purchaseOrderId: number) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        supplier: { select: { name: true, email: true } },
        warehouse: { select: { name: true } },
        lines: {
          orderBy: { lineNumber: "asc" },
          include: {
            product: { select: { name: true } },
            uom: { select: { code: true } },
          },
        },
      },
    });
    if (!po) return;

    if (!po.supplier.email) {
      console.warn("[Purchasing] Supplier has no email; PO not sent", {
        poNumber: po.poNumber,
      });
    } else {
      await emailService.sendPurchaseOrderEmail({
        to: po.supplier.email,
        supplierName: po.supplier.name,
        poNumber: po.poNumber,
        orderDate: po.orderDate,
        expectedDeliveryDate: po.expectedDeliveryDate,
        currencyCode: po.currencyCode,
        subtotal: Number(po.subtotal),
        taxAmount: Number(po.taxAmount),
        grandTotal: Number(po.grandTotal),
        paymentTerms: po.paymentTerms,
        deliverTo: po.shipToAddress ?? po.warehouse?.name ?? null,
        notes: po.notes,
        lines: po.lines.map(line => ({
          description:
            line.description ?? line.product?.name ?? `Item ${line.lineNumber}`,
          quantity: line.quantity.toFixed(2),
          uom: line.uom?.code ?? null,
          unitPrice: line.unitPrice.toFixed(2),
          lineTotal: line.lineTotal.toFixed(2),
        })),
      });
    }

    await createNotification({
      userId: po.createdById,
      type: "PURCHASE_ORDER_SENT",
      title: `${po.poNumber} has been sent to ${po.supplier.name}`,
      message: po.supplier.email
        ? `The order was emailed to ${po.supplier.email}. You will be notified when goods are received against it.`
        : `${po.supplier.name} has no email address on file, so the order could not be emailed. Send it to them another way, or add an address to the supplier record.`,
      link: `/purchasing/orders/${po.id}`,
    });
  }

  /**
   * GET /api/purchase-orders/dashboard
   * Spend and pipeline figures for the purchasing landing page.
   */
  async dashboard(req: Request, res: Response) {
    const operation = "Purchasing dashboard";
    try {
      const warehouseId = parseOptionalId(req.query.warehouseId);
      const now = new Date();
      const from = new Date(now);
      from.setUTCDate(from.getUTCDate() - 30);

      const [
        byStatus,
        recentOrders,
        completedReceipts,
        openLines,
        openRequisitions,
        activeSuppliers,
        pendingQc,
        overdue,
      ] = await Promise.all([
        prisma.purchaseOrder.groupBy({
          by: ["status"],
          where: { ...(warehouseId ? { warehouseId } : {}) },
          _count: { _all: true },
          _sum: { grandTotal: true },
        }),
        prisma.purchaseOrder.findMany({
          where: {
            orderDate: { gte: from },
            ...(warehouseId ? { warehouseId } : {}),
          },
          select: {
            grandTotal: true,
            orderDate: true,
            status: true,
            supplierId: true,
          },
        }),
        prisma.goodsReceiptNote.findMany({
          where: {
            status: "COMPLETED",
            postedAt: { gte: from, lte: now },
            ...(warehouseId ? { warehouseId } : {}),
          },
          select: { totalValue: true },
        }),
        prisma.purchaseOrderLine.findMany({
          where: {
            status: { in: ["OPEN", "PARTIALLY_RECEIVED"] },
            purchaseOrder: {
              status: {
                in: ["APPROVED", "SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"],
              },
              ...(warehouseId ? { warehouseId } : {}),
            },
          },
          select: { quantity: true, receivedQuantity: true, lineTotal: true },
        }),
        prisma.purchaseRequisition.count({
          where: {
            status: {
              in: [
                PurchaseRequisitionStatus.DRAFT,
                PurchaseRequisitionStatus.PENDING_APPROVAL,
                PurchaseRequisitionStatus.APPROVED,
              ],
            },
            ...(warehouseId ? { warehouseId } : {}),
          },
        }),
        prisma.supplier.count({ where: { status: SupplierStatus.ACTIVE } }),
        prisma.goodsReceiptNote.count({
          where: {
            status: { in: ["PENDING_QC", "QC_IN_PROGRESS"] },
            ...(warehouseId ? { warehouseId } : {}),
          },
        }),
        prisma.purchaseOrder.count({
          where: {
            status: {
              in: ["APPROVED", "SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"],
            },
            ...(warehouseId ? { warehouseId } : {}),
            OR: [
              { promisedDate: { lt: now } },
              { promisedDate: null, expectedDeliveryDate: { lt: now } },
            ],
          },
        }),
      ]);

      const spendLast30Days = completedReceipts.reduce(
        (acc, receipt) => acc.plus(receipt.totalValue),
        ZERO
      );

      const openCommitment = openLines.reduce((acc, line) => {
        const outstanding = Prisma.Decimal.max(
          ZERO,
          line.quantity.minus(line.receivedQuantity)
        );
        if (outstanding.isZero() || line.quantity.isZero()) return acc;
        return acc.plus(
          line.lineTotal.times(outstanding).dividedBy(line.quantity)
        );
      }, ZERO);
      const committedRecentOrders = recentOrders.filter(
        order =>
          order.status !== PurchaseOrderStatus.CANCELLED &&
          order.status !== PurchaseOrderStatus.DRAFT &&
          order.status !== PurchaseOrderStatus.REJECTED
      );

      return res.json({
        data: {
          period: { from, to: now },
          ordersByStatus: byStatus.map(row => ({
            status: row.status,
            count: row._count._all,
            value: roundMoney(row._sum.grandTotal ?? ZERO),
          })),
          spendLast30Days: roundMoney(spendLast30Days),
          openCommitmentValue: roundMoney(openCommitment),
          openRequisitions,
          activeSuppliers,
          receiptsPendingQc: pendingQc,
          overdueOrders: overdue,
          suppliersOrderedFromLast30Days: new Set(
            committedRecentOrders.map(order => order.supplierId)
          ).size,
        },
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }
}
