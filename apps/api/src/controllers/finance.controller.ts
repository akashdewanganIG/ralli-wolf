import { Request, Response } from "express";
import {
  InvoiceStatus,
  PaymentDirection,
  PaymentMethod,
  Prisma,
} from "@prisma/client";
import { prisma } from "@repo/db";

import { handleSupplyChainError } from "../utils/supplyChainHttp.js";
import {
  ZERO,
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

const parseId = (value: unknown) => {
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : undefined;
};

const OPEN: InvoiceStatus[] = [
  "DRAFT",
  "AWAITING_APPROVAL",
  "APPROVED",
  "PARTIALLY_PAID",
];

export class FinanceController {
  /**
   * The finance overview.
   *
   * Answers the three questions someone opens this module to ask: what do we
   * owe, what are we owed, and how much of either is late. Ageing is computed
   * from due dates rather than stored, so it is correct the moment it is read.
   */
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

      /**
       * Outstanding money, totalled per currency.
       *
       * Adding 1000 USD to 1000 INR and calling the result 2000 is not a
       * rounding problem, it is a wrong number. So every figure here belongs
       * to exactly one currency, and the headline is the currency carrying the
       * most open invoices. Anything else is reported alongside rather than
       * folded in, and `currencies` tells the caller when that has happened.
       */
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
        // The currency the business mostly works in wins the headline.
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

      // Money in and out over the last 30 days — the closest thing to a cash
      // view without a full bank reconciliation.
      const since = new Date(asOf.getTime() - 30 * 86_400_000);
      const flows = await prisma.payment.groupBy({
        by: ["direction", "currencyCode"],
        where: { paymentDate: { gte: since } },
        _sum: { amount: true },
        _count: true,
      });
      // Same rule as the invoices: one currency per figure. The headline is
      // whichever currency moved the most money in that direction.
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
          // Positive means customers owe more than we owe suppliers. It is
          // only a real number when both sides are in the same currency;
          // otherwise there is nothing meaningful to subtract.
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

  /** Payables list, newest first, with the outstanding balance resolved. */
  async listPayables(req: Request, res: Response) {
    const operation = "List supplier invoices";
    try {
      const status = req.query.status as InvoiceStatus | undefined;
      const supplierId = parseId(req.query.supplierId);
      const overdueOnly = req.query.overdue === "true";

      const rows = await prisma.supplierInvoice.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(supplierId ? { supplierId } : {}),
          ...(overdueOnly
            ? { status: { in: OPEN }, dueDate: { lt: new Date() } }
            : {}),
        },
        orderBy: { invoiceDate: "desc" },
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

  /** Receivables list. */
  async listReceivables(req: Request, res: Response) {
    const operation = "List customer invoices";
    try {
      const status = req.query.status as InvoiceStatus | undefined;
      const accountId = parseId(req.query.accountId);
      const overdueOnly = req.query.overdue === "true";

      const rows = await prisma.customerInvoice.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(accountId ? { accountId } : {}),
          ...(overdueOnly
            ? { status: { in: OPEN }, dueDate: { lt: new Date() } }
            : {}),
        },
        orderBy: { invoiceDate: "desc" },
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

  /**
   * Raises a supplier invoice, optionally pre-filled from a purchase order.
   *
   * Pulling the totals off the order rather than asking for them again is the
   * point: it means the invoice is checked against what was ordered, and a
   * mismatch is visible instead of being typed over.
   */
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

      let resolvedSupplier = parseId(supplierId);
      let sub = subtotal !== undefined ? toDecimal(subtotal, "subtotal") : null;
      let tax =
        taxAmount !== undefined ? toDecimal(taxAmount, "taxAmount") : null;
      // An invoice raised on its own can name its own currency; one raised
      // from a purchase order inherits the order's, because billing an order
      // in a currency it was not placed in is a mistake, not an option.
      let currencyCode =
        typeof requestedCurrency === "string" && requestedCurrency.trim()
          ? requestedCurrency.trim().toUpperCase()
          : "INR";

      if (purchaseOrderId) {
        const po = await prisma.purchaseOrder.findUnique({
          where: { id: parseId(purchaseOrderId)! },
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
        resolvedSupplier = resolvedSupplier ?? po.supplierId;
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
        sub = sub ?? toDecimal(po.subtotal, "subtotal");
        tax = tax ?? toDecimal(po.taxAmount, "taxAmount");
      }

      if (!resolvedSupplier) {
        throw new DomainError("A supplier is required.");
      }
      if (!sub) throw new DomainError("A subtotal is required.");

      const total = roundMoney(sub.plus(tax ?? ZERO));

      // The number is drawn inside the same transaction as the insert, so a
      // failed create does not burn an invoice number.
      const created = await prisma.$transaction(async tx => {
        const invoiceNumber = await nextDocumentNumber(
          tx,
          SEQUENCE_KEYS.SUPPLIER_INVOICE
        );
        return tx.supplierInvoice.create({
          data: {
            invoiceNumber,
            supplierRef: supplierRef ?? null,
            supplierId: resolvedSupplier,
            purchaseOrderId: parseId(purchaseOrderId) ?? null,
            grnId: parseId(grnId) ?? null,
            status: "AWAITING_APPROVAL",
            invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
            dueDate: dueDate
              ? new Date(dueDate)
              : new Date(Date.now() + 30 * 86_400_000),
            currencyCode,
            subtotal: roundMoney(sub),
            taxAmount: roundMoney(tax ?? ZERO),
            totalAmount: total,
            notes: notes ?? null,
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

  /** Raises a customer invoice, optionally pre-filled from a sales order. */
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

      let resolvedAccount = parseId(accountId);
      let sub = subtotal !== undefined ? toDecimal(subtotal, "subtotal") : null;
      let tax =
        taxAmount !== undefined ? toDecimal(taxAmount, "taxAmount") : null;
      // Sales orders do not carry a currency of their own, so an invoice
      // states its own and falls back to the base currency.
      const currencyCode =
        typeof requestedCurrency === "string" && requestedCurrency.trim()
          ? requestedCurrency.trim().toUpperCase()
          : "INR";

      if (salesOrderId) {
        const so = await prisma.salesOrder.findUnique({
          where: { id: parseId(salesOrderId)! },
          select: {
            id: true,
            accountId: true,
            subtotal: true,
            taxAmount: true,
          },
        });
        if (!so) throw new NotFoundError("Sales order");
        resolvedAccount = resolvedAccount ?? so.accountId;
        sub = sub ?? toDecimal(so.subtotal ?? 0, "subtotal");
        tax = tax ?? toDecimal(so.taxAmount ?? 0, "taxAmount");
      }

      if (!resolvedAccount) throw new DomainError("An account is required.");
      if (!sub) throw new DomainError("A subtotal is required.");

      const created = await prisma.$transaction(async tx => {
        const invoiceNumber = await nextDocumentNumber(
          tx,
          SEQUENCE_KEYS.CUSTOMER_INVOICE
        );
        return tx.customerInvoice.create({
          data: {
            invoiceNumber,
            accountId: resolvedAccount,
            salesOrderId: parseId(salesOrderId) ?? null,
            status: "APPROVED",
            invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
            dueDate: dueDate
              ? new Date(dueDate)
              : new Date(Date.now() + 30 * 86_400_000),
            currencyCode,
            subtotal: roundMoney(sub),
            taxAmount: roundMoney(tax ?? ZERO),
            totalAmount: roundMoney(sub.plus(tax ?? ZERO)),
            notes: notes ?? null,
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

  /** Approves a supplier invoice so it can be paid. */
  async approvePayable(req: Request, res: Response) {
    const operation = "Approve supplier invoice";
    try {
      const id = parseId(req.params.id);
      if (!id) throw new DomainError("Invalid invoice id.");
      const invoice = await prisma.supplierInvoice.findUnique({
        where: { id },
      });
      if (!invoice) throw new NotFoundError("Supplier invoice");
      if (
        invoice.status !== "AWAITING_APPROVAL" &&
        invoice.status !== "DRAFT"
      ) {
        throw new DomainError(
          `${invoice.invoiceNumber} is ${invoice.status.toLowerCase()} and does not need approval.`
        );
      }
      const updated = await prisma.supplierInvoice.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: req.user!.id,
          approvedAt: new Date(),
        },
      });
      res.json({ data: updated });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** Records a payment and applies it across invoices. */
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

      const payment = await recordPayment({
        direction,
        method: (method as PaymentMethod) ?? "BANK_TRANSFER",
        reference: reference ?? null,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        currencyCode: currencyCode ?? "INR",
        amount,
        supplierId: parseId(supplierId) ?? null,
        accountId: parseId(accountId) ?? null,
        notes: notes ?? null,
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

  /** Payment history. */
  async listPayments(req: Request, res: Response) {
    const operation = "List payments";
    try {
      const direction = req.query.direction as PaymentDirection | undefined;
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

  /**
   * Documents that could be invoiced but have not been.
   *
   * This is the working list for whoever raises invoices: received purchase
   * orders with no supplier invoice against them, and delivered sales orders
   * with nothing billed.
   */
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
