import { Request, Response } from "express";
import {
  InvoiceStatus,
  PaymentDirection,
  PaymentMethod,
  Prisma,
} from "@prisma/client";
import { prisma } from "@repo/db";

import {
  handleSupplyChainError,
  optionalString,
  parseBoolean,
  parseDate,
  parseEnum,
  parseOptionalId,
  requireString,
} from "../utils/supply-chain-http.js";
import {
  ZERO,
  requireNonNegative,
  roundMoney,
  toDecimal,
} from "../services/supplyChain/decimal.js";
import { DomainError, NotFoundError } from "../services/supplyChain/errors.js";
import {
  AGEING_BUCKETS,
  bucketFor,
  outstandingOf,
  recordPayment,
} from "../services/finance/finance.service.js";
import {
  SEQUENCE_KEYS,
  nextDocumentNumber,
} from "../services/supplyChain/numbering.service.js";
import { parsePositiveInteger } from "../utils/validators.js";

const parseId = (value: unknown) => parsePositiveInteger(value) ?? undefined;

const OPEN: InvoiceStatus[] = [
  "DRAFT",
  "AWAITING_APPROVAL",
  "APPROVED",
  "PARTIALLY_PAID",
];

export class FinanceController {
  async dashboard(req: Request, res: Response) {
    const operation = "Finance dashboard";
    try {
      const asOf = new Date();

      const [payables, receivables, recentPayments] = await Promise.all([
        prisma.supplierInvoice.findMany({
          where: { status: { in: OPEN } },
          select: {
            id: true,
            invoiceNumber: true,
            dueDate: true,
            currencyCode: true,
            totalAmount: true,
            amountPaid: true,
            status: true,
            supplier: { select: { id: true, code: true, name: true } },
          },
        }),
        prisma.customerInvoice.findMany({
          where: { status: { in: OPEN } },
          select: {
            id: true,
            invoiceNumber: true,
            dueDate: true,
            currencyCode: true,
            totalAmount: true,
            amountPaid: true,
            status: true,
            account: { select: { id: true, name: true } },
          },
        }),
        prisma.payment.findMany({
          orderBy: { paymentDate: "desc" },
          take: 8,
          include: {
            supplier: { select: { name: true } },
            account: { select: { name: true } },
          },
        }),
      ]);

      const summarise = (rows: typeof payables | typeof receivables) => {
        const emptyAgeing = () =>
          Object.fromEntries(
            AGEING_BUCKETS.map(b => [
              b.key,
              { label: b.label, amount: "0.00", count: 0 },
            ])
          ) as Record<string, { label: string; amount: string; count: number }>;

        type Bucketed = {
          total: Prisma.Decimal;
          overdue: Prisma.Decimal;
          overdueCount: number;
          openCount: number;
          ageing: ReturnType<typeof emptyAgeing>;
        };
        const perCurrency = new Map<string, Bucketed>();

        for (const row of rows) {
          const left = outstandingOf(row);
          if (left.lessThanOrEqualTo(0)) continue;

          const code = row.currencyCode;
          let acc = perCurrency.get(code);
          if (!acc) {
            acc = {
              total: ZERO,
              overdue: ZERO,
              overdueCount: 0,
              openCount: 0,
              ageing: emptyAgeing(),
            };
            perCurrency.set(code, acc);
          }

          acc.total = acc.total.plus(left);
          acc.openCount += 1;
          const { days, bucket } = bucketFor(row.dueDate, asOf);
          const slot = acc.ageing[bucket]!;
          slot.amount = roundMoney(
            toDecimal(slot.amount, "bucket").plus(left)
          ).toFixed(2);
          slot.count += 1;
          if (days > 0) {
            acc.overdue = acc.overdue.plus(left);
            acc.overdueCount += 1;
          }
        }

        const shape = (code: string, acc: Bucketed) => ({
          currencyCode: code,
          outstanding: roundMoney(acc.total).toFixed(2),
          overdue: roundMoney(acc.overdue).toFixed(2),
          overdueCount: acc.overdueCount,
          openCount: acc.openCount,
          ageing: acc.ageing,
        });

        const byCurrency = Object.fromEntries(
          [...perCurrency].map(([code, acc]) => [code, shape(code, acc)])
        );

        const primary =
          [...perCurrency.entries()].sort(
            (a, b) => b[1].openCount - a[1].openCount
          )[0] ?? null;

        return {
          ...(primary
            ? shape(primary[0], primary[1])
            : {
                currencyCode: "INR",
                outstanding: "0.00",
                overdue: "0.00",
                overdueCount: 0,
                openCount: 0,
                ageing: emptyAgeing(),
              }),
          currencies: [...perCurrency.keys()].sort(),
          byCurrency,
        };
      };

      const since = new Date(asOf.getTime() - 30 * 86_400_000);
      const flows = await prisma.payment.groupBy({
        by: ["direction", "currencyCode"],
        where: { paymentDate: { gte: since } },
        _sum: { amount: true },
        _count: true,
      });

      const flowOf = (d: PaymentDirection) => {
        const rows = flows.filter(f => f.direction === d);
        const biggest = rows
          .slice()
          .sort((a, b) =>
            toDecimal(b._sum.amount ?? 0, "flow").comparedTo(
              toDecimal(a._sum.amount ?? 0, "flow")
            )
          )[0];
        return {
          amount: roundMoney(
            toDecimal(biggest?._sum.amount ?? 0, "flow")
          ).toFixed(2),
          count: rows.reduce((a, r) => a + r._count, 0),
          currencyCode: biggest?.currencyCode ?? "INR",
          currencies: rows.map(r => r.currencyCode).sort(),
        };
      };

      const ap = summarise(payables);
      const ar = summarise(receivables);

      res.json({
        data: {
          asOf,
          payables: ap,
          receivables: ar,

          netPosition:
            ap.currencyCode === ar.currencyCode
              ? roundMoney(
                  toDecimal(ar.outstanding, "ar").minus(
                    toDecimal(ap.outstanding, "ap")
                  )
                ).toFixed(2)
              : null,
          netPositionCurrency:
            ap.currencyCode === ar.currencyCode ? ap.currencyCode : null,
          last30Days: {
            paidOut: flowOf("OUTGOING"),
            receivedIn: flowOf("INCOMING"),
          },
          recentPayments,
        },
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async listPayables(req: Request, res: Response) {
    const operation = "List supplier invoices";
    try {
      const status = parseEnum(InvoiceStatus, req.query.status, "status");
      const supplierId = parseOptionalId(req.query.supplierId, "supplierId");
      const overdueOnly = parseBoolean(req.query.overdue, "overdue") ?? false;

      const rows = await prisma.supplierInvoice.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(supplierId !== null ? { supplierId } : {}),
          ...(overdueOnly
            ? { status: { in: OPEN }, dueDate: { lt: new Date() } }
            : {}),
        },
        orderBy: { invoiceDate: "desc" },
        take: 200,
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          purchaseOrder: { select: { id: true, poNumber: true } },
          grn: { select: { id: true, grnNumber: true } },
        },
      });

      res.json({
        data: rows.map(row => ({
          ...row,
          outstanding: outstandingOf(row).toFixed(2),
          ageing: bucketFor(row.dueDate),
        })),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async listReceivables(req: Request, res: Response) {
    const operation = "List customer invoices";
    try {
      const status = parseEnum(InvoiceStatus, req.query.status, "status");
      const accountId = parseOptionalId(req.query.accountId, "accountId");
      const overdueOnly = parseBoolean(req.query.overdue, "overdue") ?? false;

      const rows = await prisma.customerInvoice.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(accountId !== null ? { accountId } : {}),
          ...(overdueOnly
            ? { status: { in: OPEN }, dueDate: { lt: new Date() } }
            : {}),
        },
        orderBy: { invoiceDate: "desc" },
        take: 200,
        include: {
          account: { select: { id: true, name: true } },
          salesOrder: { select: { id: true, orderNumber: true } },
        },
      });

      res.json({
        data: rows.map(row => ({
          ...row,
          outstanding: outstandingOf(row).toFixed(2),
          ageing: bucketFor(row.dueDate),
        })),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async createPayable(req: Request, res: Response) {
    const operation = "Create supplier invoice";
    try {
      const userId = req.user!.id;
      const {
        supplierId,
        purchaseOrderId,
        grnId,
        supplierRef,
        invoiceDate,
        dueDate,
        subtotal,
        taxAmount,
        notes,
        currencyCode: requestedCurrency,
      } = req.body ?? {};

      const resolvedPurchaseOrderId = parseOptionalId(
        purchaseOrderId,
        "purchaseOrderId"
      );
      const resolvedGrnId = parseOptionalId(grnId, "grnId");
      let resolvedSupplier = parseOptionalId(supplierId, "supplierId");
      let sub =
        subtotal !== undefined
          ? requireNonNegative(subtotal, "subtotal")
          : null;
      let tax =
        taxAmount !== undefined
          ? requireNonNegative(taxAmount, "taxAmount")
          : null;

      let currencyCode = requireString(
        requestedCurrency ?? "INR",
        "currencyCode",
        3
      ).toUpperCase();
      if (!/^[A-Z]{3}$/.test(currencyCode)) {
        throw new DomainError("currencyCode must be a three-letter ISO code.");
      }

      if (resolvedPurchaseOrderId) {
        const po = await prisma.purchaseOrder.findUnique({
          where: { id: resolvedPurchaseOrderId },
          select: {
            id: true,
            supplierId: true,
            currencyCode: true,
            subtotal: true,
            taxAmount: true,
            poNumber: true,
          },
        });
        if (!po) throw new NotFoundError("Purchase order");
        if (resolvedSupplier !== null && resolvedSupplier !== po.supplierId) {
          throw new DomainError(
            `${po.poNumber} belongs to a different supplier.`
          );
        }
        resolvedSupplier = po.supplierId;
        if (
          typeof requestedCurrency === "string" &&
          requestedCurrency.trim() &&
          requestedCurrency.trim().toUpperCase() !== po.currencyCode
        ) {
          throw new DomainError(
            `${po.poNumber} was placed in ${po.currencyCode}; it cannot be invoiced in ${requestedCurrency}.`
          );
        }
        currencyCode = po.currencyCode;
        if (sub !== null && !roundMoney(sub).equals(roundMoney(po.subtotal))) {
          throw new DomainError(
            `subtotal must match ${po.poNumber}'s subtotal of ${po.subtotal.toFixed(2)}.`
          );
        }
        if (tax !== null && !roundMoney(tax).equals(roundMoney(po.taxAmount))) {
          throw new DomainError(
            `taxAmount must match ${po.poNumber}'s tax amount of ${po.taxAmount.toFixed(2)}.`
          );
        }
        sub = po.subtotal;
        tax = po.taxAmount;
      }

      if (resolvedGrnId) {
        const grn = await prisma.goodsReceiptNote.findUnique({
          where: { id: resolvedGrnId },
          select: {
            grnNumber: true,
            supplierId: true,
            purchaseOrderId: true,
            status: true,
          },
        });
        if (!grn) throw new NotFoundError("Goods receipt");
        if (grn.status !== "COMPLETED") {
          throw new DomainError(
            `${grn.grnNumber} must be completed before it can support an invoice.`
          );
        }
        if (resolvedSupplier !== null && resolvedSupplier !== grn.supplierId) {
          throw new DomainError(
            `${grn.grnNumber} belongs to a different supplier.`
          );
        }
        if (
          resolvedPurchaseOrderId !== null &&
          grn.purchaseOrderId !== resolvedPurchaseOrderId
        ) {
          throw new DomainError(
            `${grn.grnNumber} does not belong to the selected purchase order.`
          );
        }
        resolvedSupplier = grn.supplierId;
      }

      if (!resolvedSupplier) {
        throw new DomainError("A supplier is required.");
      }
      if (!sub) throw new DomainError("A subtotal is required.");

      const total = roundMoney(sub.plus(tax ?? ZERO));
      if (!total.greaterThan(0)) {
        throw new DomainError("Invoice total must be greater than zero.");
      }
      const resolvedInvoiceDate =
        parseDate(invoiceDate, "invoiceDate") ?? new Date();
      const resolvedDueDate =
        parseDate(dueDate, "dueDate") ??
        new Date(resolvedInvoiceDate.getTime() + 30 * 86_400_000);
      if (resolvedDueDate < resolvedInvoiceDate) {
        throw new DomainError("dueDate cannot be earlier than invoiceDate.");
      }

      const created = await prisma.$transaction(async tx => {
        const invoiceNumber = await nextDocumentNumber(
          tx,
          SEQUENCE_KEYS.SUPPLIER_INVOICE
        );
        return tx.supplierInvoice.create({
          data: {
            invoiceNumber,
            supplierRef: optionalString(supplierRef, "supplierRef", 200),
            supplierId: resolvedSupplier,
            purchaseOrderId: resolvedPurchaseOrderId,
            grnId: resolvedGrnId,
            status: "AWAITING_APPROVAL",
            invoiceDate: resolvedInvoiceDate,
            dueDate: resolvedDueDate,
            currencyCode,
            subtotal: roundMoney(sub),
            taxAmount: roundMoney(tax ?? ZERO),
            totalAmount: total,
            notes: optionalString(notes, "notes"),
            createdById: userId,
          },
          include: { supplier: { select: { code: true, name: true } } },
        });
      });

      res.status(201).json({ data: created });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async createReceivable(req: Request, res: Response) {
    const operation = "Create customer invoice";
    try {
      const userId = req.user!.id;
      const {
        accountId,
        salesOrderId,
        invoiceDate,
        dueDate,
        subtotal,
        taxAmount,
        notes,
        currencyCode: requestedCurrency,
      } = req.body ?? {};

      const resolvedSalesOrderId = parseOptionalId(
        salesOrderId,
        "salesOrderId"
      );
      let resolvedAccount = parseOptionalId(accountId, "accountId");
      let sub =
        subtotal !== undefined
          ? requireNonNegative(subtotal, "subtotal")
          : null;
      let tax =
        taxAmount !== undefined
          ? requireNonNegative(taxAmount, "taxAmount")
          : null;

      const currencyCode = requireString(
        requestedCurrency ?? "INR",
        "currencyCode",
        3
      ).toUpperCase();
      if (!/^[A-Z]{3}$/.test(currencyCode)) {
        throw new DomainError("currencyCode must be a three-letter ISO code.");
      }

      if (resolvedSalesOrderId) {
        const so = await prisma.salesOrder.findUnique({
          where: { id: resolvedSalesOrderId },
          select: {
            id: true,
            orderNumber: true,
            accountId: true,
            subtotal: true,
            taxAmount: true,
          },
        });
        if (!so) throw new NotFoundError("Sales order");
        if (resolvedAccount !== null && resolvedAccount !== so.accountId) {
          throw new DomainError(
            `${so.orderNumber} belongs to a different customer account.`
          );
        }
        resolvedAccount = so.accountId;
        if (sub !== null && !roundMoney(sub).equals(roundMoney(so.subtotal))) {
          throw new DomainError(
            `subtotal must match ${so.orderNumber}'s subtotal of ${so.subtotal.toFixed(2)}.`
          );
        }
        if (tax !== null && !roundMoney(tax).equals(roundMoney(so.taxAmount))) {
          throw new DomainError(
            `taxAmount must match ${so.orderNumber}'s tax amount of ${so.taxAmount.toFixed(2)}.`
          );
        }
        sub = so.subtotal;
        tax = so.taxAmount;
      }

      if (!resolvedAccount) throw new DomainError("An account is required.");
      if (!sub) throw new DomainError("A subtotal is required.");
      const total = roundMoney(sub.plus(tax ?? ZERO));
      if (!total.greaterThan(0)) {
        throw new DomainError("Invoice total must be greater than zero.");
      }
      const resolvedInvoiceDate =
        parseDate(invoiceDate, "invoiceDate") ?? new Date();
      const resolvedDueDate =
        parseDate(dueDate, "dueDate") ??
        new Date(resolvedInvoiceDate.getTime() + 30 * 86_400_000);
      if (resolvedDueDate < resolvedInvoiceDate) {
        throw new DomainError("dueDate cannot be earlier than invoiceDate.");
      }

      const created = await prisma.$transaction(async tx => {
        const invoiceNumber = await nextDocumentNumber(
          tx,
          SEQUENCE_KEYS.CUSTOMER_INVOICE
        );
        return tx.customerInvoice.create({
          data: {
            invoiceNumber,
            accountId: resolvedAccount,
            salesOrderId: resolvedSalesOrderId,
            status: "APPROVED",
            invoiceDate: resolvedInvoiceDate,
            dueDate: resolvedDueDate,
            currencyCode,
            subtotal: roundMoney(sub),
            taxAmount: roundMoney(tax ?? ZERO),
            totalAmount: total,
            notes: optionalString(notes, "notes"),
            createdById: userId,
          },
          include: { account: { select: { name: true } } },
        });
      });

      res.status(201).json({ data: created });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async approvePayable(req: Request, res: Response) {
    const operation = "Approve supplier invoice";
    try {
      const id = parseId(req.params.id);
      if (!id) throw new DomainError("Invalid invoice id.");
      const invoice = await prisma.supplierInvoice.findUnique({
        where: { id },
      });
      if (!invoice) throw new NotFoundError("Supplier invoice");
      if (invoice.status !== "AWAITING_APPROVAL") {
        throw new DomainError(
          `${invoice.invoiceNumber} is ${invoice.status.toLowerCase()} and does not need approval.`
        );
      }
      if (invoice.createdById === req.user!.id) {
        throw new DomainError(
          "The invoice author cannot approve their own payable.",
          { status: 403, code: "SELF_APPROVAL_NOT_ALLOWED" }
        );
      }
      const claimed = await prisma.supplierInvoice.updateMany({
        where: { id, status: "AWAITING_APPROVAL" },
        data: {
          status: "APPROVED",
          approvedById: req.user!.id,
          approvedAt: new Date(),
        },
      });
      if (claimed.count !== 1) {
        throw new DomainError(
          "Invoice status changed while it was being approved.",
          { status: 409, code: "INVOICE_STATE_CHANGED" }
        );
      }
      const updated = await prisma.supplierInvoice.findUniqueOrThrow({
        where: { id },
      });
      res.json({ data: updated });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async recordPayment(req: Request, res: Response) {
    const operation = "Record payment";
    try {
      const {
        direction,
        method,
        reference,
        paymentDate,
        currencyCode,
        amount,
        supplierId,
        accountId,
        notes,
        allocations,
      } = req.body ?? {};

      if (direction !== "OUTGOING" && direction !== "INCOMING") {
        throw new DomainError("Direction must be OUTGOING or INCOMING.");
      }
      if (amount === undefined) throw new DomainError("An amount is required.");
      if (
        allocations !== undefined &&
        (!Array.isArray(allocations) || allocations.length > 100)
      ) {
        throw new DomainError(
          "allocations must be an array of at most 100 rows."
        );
      }
      const normalizedCurrency = requireString(
        currencyCode ?? "INR",
        "currencyCode",
        3
      ).toUpperCase();
      if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
        throw new DomainError("currencyCode must be a three-letter ISO code.");
      }

      const payment = await recordPayment({
        direction,
        method:
          parseEnum(PaymentMethod, method, "method") ??
          PaymentMethod.BANK_TRANSFER,
        reference: optionalString(reference, "reference", 200),
        paymentDate: parseDate(paymentDate, "paymentDate") ?? new Date(),
        currencyCode: normalizedCurrency,
        amount,
        supplierId: parseOptionalId(supplierId, "supplierId"),
        accountId: parseOptionalId(accountId, "accountId"),
        notes: optionalString(notes, "notes"),
        recordedById: req.user!.id,
        allocations: Array.isArray(allocations)
          ? allocations.map((a: Record<string, unknown>) => ({
              supplierInvoiceId: parseId(a.supplierInvoiceId),
              customerInvoiceId: parseId(a.customerInvoiceId),
              amount: a.amount as string,
            }))
          : [],
      });

      res.status(201).json({ data: payment });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async listPayments(req: Request, res: Response) {
    const operation = "List payments";
    try {
      const direction = parseEnum(
        PaymentDirection,
        req.query.direction,
        "direction"
      );
      const rows = await prisma.payment.findMany({
        where: direction ? { direction } : {},
        orderBy: { paymentDate: "desc" },
        take: 100,
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          account: { select: { id: true, name: true } },
          recordedBy: { select: { firstName: true, lastName: true } },
          allocations: {
            include: {
              supplierInvoice: { select: { invoiceNumber: true } },
              customerInvoice: { select: { invoiceNumber: true } },
            },
          },
        },
      });
      res.json({ data: rows });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  async uninvoiced(req: Request, res: Response) {
    const operation = "Uninvoiced documents";
    try {
      const [purchaseOrders, salesOrders] = await Promise.all([
        prisma.purchaseOrder.findMany({
          where: {
            status: { in: ["PARTIALLY_RECEIVED", "RECEIVED", "CLOSED"] },
            supplierInvoices: { none: {} },
          },
          select: {
            id: true,
            poNumber: true,
            orderDate: true,
            currencyCode: true,
            subtotal: true,
            taxAmount: true,
            grandTotal: true,
            supplier: { select: { id: true, code: true, name: true } },
          },
          orderBy: { orderDate: "desc" },
          take: 50,
        }),
        prisma.salesOrder.findMany({
          where: {
            status: { in: ["SHIPPED", "DELIVERED"] },
            customerInvoices: { none: {} },
          },
          select: {
            id: true,
            orderNumber: true,
            orderDate: true,
            subtotal: true,
            taxAmount: true,
            grandTotal: true,
            account: { select: { id: true, name: true } },
          },
          orderBy: { orderDate: "desc" },
          take: 50,
        }),
      ]);
      res.json({ data: { purchaseOrders, salesOrders } });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }
}
