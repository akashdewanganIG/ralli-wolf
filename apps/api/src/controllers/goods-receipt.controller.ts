import { Request, Response } from "express";
import { prisma } from "@repo/db";
import {
  Prisma,
  AuditCategory,
  GrnStatus,
  QcResult,
  UserRole,
} from "@prisma/client";
import {
  createGoodsReceipt,
  postGoodsReceipt,
  recordQualityCheck,
} from "../services/supplyChain/procurement.service.js";
import { DomainError, NotFoundError } from "../services/supplyChain/errors.js";
import { createNotification } from "./notification.controller.js";
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
  requireUserId,
} from "../utils/supply-chain-http.js";

const GRN_INCLUDE = {
  supplier: { select: { id: true, code: true, name: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  purchaseOrder: {
    select: {
      id: true,
      poNumber: true,
      status: true,
      promisedDate: true,
      expectedDeliveryDate: true,
    },
  },
  receivedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

export class GoodsReceiptController {
  async list(req: Request, res: Response) {
    const operation = "List goods receipts";
    try {
      const pagination = parsePagination(req, 25);
      const status = parseEnum(GrnStatus, req.query.status, "status");
      const supplierId = parseOptionalId(req.query.supplierId);
      const warehouseId = parseOptionalId(req.query.warehouseId);
      const purchaseOrderId = parseOptionalId(req.query.purchaseOrderId);
      const search = optionalString(req.query.search);

      const where: Prisma.GoodsReceiptNoteWhereInput = {
        ...(status ? { status } : {}),
        ...(supplierId ? { supplierId } : {}),
        ...(warehouseId ? { warehouseId } : {}),
        ...(purchaseOrderId ? { purchaseOrderId } : {}),
        ...(search
          ? {
              OR: [
                { grnNumber: { contains: search, mode: "insensitive" } },
                {
                  supplierInvoiceNumber: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  supplier: { name: { contains: search, mode: "insensitive" } },
                },
              ],
            }
          : {}),
      };

      const [totalItems, receipts] = await Promise.all([
        prisma.goodsReceiptNote.count({ where }),
        prisma.goodsReceiptNote.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { receivedDate: "desc" },
          include: {
            ...GRN_INCLUDE,
            _count: { select: { lines: true, qualityChecks: true } },
          },
        }),
      ]);

      return res.json({
        data: receipts,
        pagination: paginationMeta(totalItems, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async getById(req: Request, res: Response) {
    const operation = "Get goods receipt";
    try {
      const id = parseId(req.params.id, "GRN id");
      const receipt = await prisma.goodsReceiptNote.findUnique({
        where: { id },
        include: {
          ...GRN_INCLUDE,
          lines: {
            orderBy: { lineNumber: "asc" },
            include: {
              product: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  trackingType: true,
                  itemType: true,
                  uom: { select: { code: true } },
                },
              },
              uom: { select: { id: true, code: true } },
              lot: {
                select: {
                  id: true,
                  lotNumber: true,
                  batchNumber: true,
                  expiryDate: true,
                },
              },
              putawayBin: { select: { id: true, code: true } },
              purchaseOrderLine: {
                select: {
                  id: true,
                  lineNumber: true,
                  quantity: true,
                  receivedQuantity: true,
                  unitPrice: true,
                },
              },
              qualityChecks: {
                orderBy: { inspectedAt: "desc" },
                include: {
                  parameters: true,
                  inspectedBy: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
      });
      if (!receipt) throw new NotFoundError("Goods receipt note");
      return res.json({ data: receipt });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async create(req: Request, res: Response) {
    const operation = "Create goods receipt";
    try {
      const userId = requireUserId(req);
      const lines = requireArray<Record<string, unknown>>(
        req.body.lines,
        "lines"
      );

      const grn = await prisma.$transaction(tx =>
        createGoodsReceipt(tx, {
          purchaseOrderId: parseOptionalId(req.body.purchaseOrderId),
          supplierId: parseOptionalId(req.body.supplierId),
          warehouseId: parseOptionalId(req.body.warehouseId),
          receivedDate:
            parseDate(req.body.receivedDate, "receivedDate") ?? new Date(),
          supplierInvoiceNumber: optionalString(req.body.supplierInvoiceNumber),
          supplierInvoiceDate: parseDate(
            req.body.supplierInvoiceDate,
            "supplierInvoiceDate"
          ),
          vehicleNumber: optionalString(req.body.vehicleNumber),
          lrNumber: optionalString(req.body.lrNumber),
          notes: optionalString(req.body.notes),
          requiresQc: parseBoolean(req.body.requiresQc) ?? false,
          receivedById: userId,
          lines: lines.map((line, index) => ({
            purchaseOrderLineId: parseOptionalId(line.purchaseOrderLineId),
            productId: parseId(
              String(line.productId),
              `lines[${index}].productId`
            ),
            receivedQuantity: line.receivedQuantity as string,
            acceptedQuantity: (line.acceptedQuantity as string) ?? null,
            rejectedQuantity: (line.rejectedQuantity as string) ?? null,
            unitCost: (line.unitCost as string) ?? null,
            uomId: parseOptionalId(line.uomId),
            batchNumber: optionalString(line.batchNumber),
            serialNumbers: Array.isArray(line.serialNumbers)
              ? (line.serialNumbers as string[])
              : [],
            manufacturedDate: parseDate(
              line.manufacturedDate,
              "manufacturedDate"
            ),
            expiryDate: parseDate(line.expiryDate, "expiryDate"),
            rejectionReason: optionalString(line.rejectionReason),
            putawayBinId: parseOptionalId(line.putawayBinId),
          })),
        })
      );

      const full = await prisma.goodsReceiptNote.findUnique({
        where: { id: grn.id },
        include: GRN_INCLUDE,
      });
      return res.status(201).json({ data: full });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async post(req: Request, res: Response) {
    const operation = "Post goods receipt";
    try {
      const userId = requireUserId(req);
      const id = parseId(req.params.id, "GRN id");

      const result = await prisma.$transaction(
        tx =>
          postGoodsReceipt(tx, {
            grnId: id,
            userId,
            createPutawayTasks:
              parseBoolean(req.body.createPutawayTasks) ?? true,
          }),

        { timeout: 60_000, maxWait: 10_000 }
      );

      await prisma.auditLog.create({
        data: {
          entityType: "GoodsReceiptNote",
          entityId: id,
          changedBy: userId,
          action: "POST",
          category: AuditCategory.PROCUREMENT,
          newValues: {
            grnNumber: result.grnNumber,
            postedLines: result.postedLines.length,
          },
        },
      });

      return res.json({ data: result });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async cancel(req: Request, res: Response) {
    const operation = "Cancel goods receipt";
    try {
      const id = parseId(req.params.id, "GRN id");
      const receipt = await prisma.goodsReceiptNote.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!receipt) throw new NotFoundError("Goods receipt note");
      if (
        receipt.status === GrnStatus.COMPLETED ||
        receipt.lines.some(line => line.isPosted)
      ) {
        throw new DomainError(
          "This receipt has already been posted to stock. Reverse it with a stock adjustment or a purchase return instead.",
          { status: 409, code: "GRN_ALREADY_POSTED" }
        );
      }

      const updated = await prisma.goodsReceiptNote.update({
        where: { id },
        data: {
          status: GrnStatus.CANCELLED,
          notes: optionalString(req.body.reason) ?? receipt.notes,
        },
      });

      return res.json({ data: updated });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async createQualityCheck(req: Request, res: Response) {
    const operation = "Record quality check";
    try {
      const userId = requireUserId(req);
      const lineId = parseId(req.params.lineId, "GRN line id");

      const qualityCheck = await prisma.$transaction(tx =>
        recordQualityCheck(tx, {
          grnLineId: lineId,
          inspectedQuantity: req.body.inspectedQuantity,
          acceptedQuantity: req.body.acceptedQuantity,
          rejectedQuantity: req.body.rejectedQuantity ?? null,
          sampleSize: req.body.sampleSize ?? null,
          defectType: optionalString(req.body.defectType),
          remarks: optionalString(req.body.remarks),
          inspectedById: userId,
          parameters: Array.isArray(req.body.parameters)
            ? req.body.parameters.map((parameter: Record<string, unknown>) => ({
                parameterName: String(parameter.parameterName ?? ""),
                specification: optionalString(parameter.specification),
                minValue: (parameter.minValue as string) ?? null,
                maxValue: (parameter.maxValue as string) ?? null,
                observedValue: optionalString(parameter.observedValue),
              }))
            : [],
        })
      );

      if (
        qualityCheck.result === QcResult.FAIL ||
        qualityCheck.result === QcResult.CONDITIONAL_PASS
      ) {
        const line = await prisma.goodsReceiptLine.findUnique({
          where: { id: lineId },
          include: {
            grn: { include: { supplier: { select: { name: true } } } },
            product: { select: { code: true, name: true } },
          },
        });
        if (line) {
          const admins = await prisma.user.findMany({
            where: {
              role: { in: [UserRole.ADMIN] },
              deletedAt: null,
            },
            select: { id: true },
          });
          await Promise.allSettled(
            admins.map(admin =>
              createNotification({
                userId: admin.id,
                type: "QC_FAILED",
                title: `Quality check ${qualityCheck.result === QcResult.FAIL ? "failed" : "passed with conditions"} — ${line.grn.grnNumber}`,
                message: `${line.product.code} from ${line.grn.supplier.name}: ${qualityCheck.rejectedQuantity.toFixed(4)} rejected of ${qualityCheck.inspectedQuantity.toFixed(4)} inspected.`,
                link: `/purchasing/goods-receipts/${line.grnId}`,
              })
            )
          );
        }
      }

      return res.status(201).json({ data: qualityCheck });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async listQualityChecks(req: Request, res: Response) {
    const operation = "List quality checks";
    try {
      const pagination = parsePagination(req, 25);
      const result = parseEnum(QcResult, req.query.result, "result");
      const supplierId = parseOptionalId(req.query.supplierId);

      const where: Prisma.QualityCheckWhereInput = {
        ...(result ? { result } : {}),
        ...(supplierId ? { grn: { supplierId } } : {}),
      };

      const [totalItems, checks] = await Promise.all([
        prisma.qualityCheck.count({ where }),
        prisma.qualityCheck.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { inspectedAt: "desc" },
          include: {
            grn: {
              select: {
                id: true,
                grnNumber: true,
                receivedDate: true,
                supplier: { select: { id: true, code: true, name: true } },
              },
            },
            grnLine: {
              select: {
                id: true,
                product: { select: { id: true, code: true, name: true } },
              },
            },
            inspectedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
            parameters: true,
          },
        }),
      ]);

      return res.json({
        data: checks,
        pagination: paginationMeta(totalItems, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }
}
