import {
  InvoiceStatus,
  PaymentDirection,
  PaymentMethod,
  Prisma,
} from "@prisma/client";
import { prisma } from "@repo/db";

import { ZERO, roundMoney, toDecimal } from "../supplyChain/decimal.js";
import { DomainError, NotFoundError } from "../supplyChain/errors.js";
import {
  SEQUENCE_KEYS,
  nextDocumentNumber,
} from "../supplyChain/numbering.service.js";

/**
 * Money movement for the finance module.
 *
 * Two rules hold everywhere in here:
 *
 * 1. `amountPaid` on an invoice is never written directly. It is recomputed
 *    from that invoice's allocations inside the same transaction that changes
 *    them, so the balance can never drift from the payments that justify it.
 * 2. Status follows the numbers. An invoice is PAID when nothing is
 *    outstanding and PARTIALLY_PAID when something has been applied — the
 *    caller does not get to assert a status that contradicts the ledger.
 */

/** Statuses that mean the invoice is settled or abandoned. */
const CLOSED: InvoiceStatus[] = ["PAID", "CANCELLED", "WRITTEN_OFF"];

export type InvoiceSide = "SUPPLIER" | "CUSTOMER";

/**
 * Supplier and customer invoices are separate tables with separate Prisma
 * delegates, but every operation in here touches only the columns the two have
 * in common. This is the shape of that overlap, so the two delegates can be
 * used through one variable without discarding type-checking altogether.
 */
type InvoiceDelegate = {
  findUnique(args: {
    where: { id: number };
    select: Record<string, boolean>;
  }): Promise<Record<string, unknown> | null>;
  update(args: {
    where: { id: number };
    data: { amountPaid: Prisma.Decimal; status: InvoiceStatus };
  }): Promise<unknown>;
};

/**
 * Serialise every payment that touches one invoice.
 *
 * Checking the outstanding balance and then writing an allocation is a
 * read-modify-write, and it is not safe on its own: two payments can both read
 * 10,000 outstanding, both decide they fit, and both commit — paying a
 * supplier twice. A transaction-scoped advisory lock makes the second wait for
 * the first to commit, and Postgres releases it on commit or rollback.
 *
 * The first key separates the two invoice tables so that supplier invoice 7
 * and customer invoice 7 do not contend with each other.
 */
const LOCK_NAMESPACE: Record<InvoiceSide, number> = {
  SUPPLIER: 0x5f10,
  CUSTOMER: 0x5f20,
};

async function lockInvoice(
  tx: Prisma.TransactionClient,
  side: InvoiceSide,
  invoiceId: number
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE[side]}::int, ${invoiceId}::int)`;
}

/** Both delegates satisfy {@link InvoiceDelegate}; TypeScript cannot see it. */
function invoiceDelegate(
  tx: Prisma.TransactionClient,
  side: InvoiceSide
): InvoiceDelegate {
  return (side === "SUPPLIER"
    ? tx.supplierInvoice
    : tx.customerInvoice) as unknown as InvoiceDelegate;
}

/**
 * Recomputes an invoice's paid amount and status from its allocations.
 * Runs inside the caller's transaction so the two can never disagree.
 */
async function refreshInvoice(
  tx: Prisma.TransactionClient,
  side: InvoiceSide,
  invoiceId: number
) {
  const where =
    side === "SUPPLIER"
      ? { supplierInvoiceId: invoiceId }
      : { customerInvoiceId: invoiceId };

  const agg = await tx.paymentAllocation.aggregate({
    where,
    _sum: { amount: true },
  });
  const paid = roundMoney(toDecimal(agg._sum.amount ?? 0, "amountPaid"));

  const delegate = invoiceDelegate(tx, side);
  const invoice = (await delegate.findUnique({
    where: { id: invoiceId },
    select: { totalAmount: true, status: true },
  })) as { totalAmount: Prisma.Decimal; status: InvoiceStatus } | null;
  if (!invoice) throw new NotFoundError("Invoice");

  const total = toDecimal(invoice.totalAmount, "totalAmount");
  // A cancelled or written-off invoice keeps that status even if money was
  // applied before it was closed; reopening is a deliberate act, not a
  // side effect of recalculation.
  let status: InvoiceStatus = invoice.status;
  if (invoice.status !== "CANCELLED" && invoice.status !== "WRITTEN_OFF") {
    if (paid.greaterThanOrEqualTo(total) && total.greaterThan(0)) {
      status = "PAID";
    } else if (paid.greaterThan(0)) {
      status = "PARTIALLY_PAID";
    } else if (
      invoice.status === "PAID" ||
      invoice.status === "PARTIALLY_PAID"
    ) {
      // Allocations were removed — fall back to approved rather than draft,
      // because an invoice that was being paid had already been approved.
      status = "APPROVED";
    }
  }

  await delegate.update({
    where: { id: invoiceId },
    data: { amountPaid: paid, status },
  });

  return { paid, total, outstanding: roundMoney(total.minus(paid)), status };
}

/** Outstanding balance on one invoice. */
export function outstandingOf(invoice: {
  totalAmount: Prisma.Decimal | number | string;
  amountPaid: Prisma.Decimal | number | string;
  status: InvoiceStatus;
}): Prisma.Decimal {
  if (CLOSED.includes(invoice.status) && invoice.status !== "PAID") return ZERO;
  const total = toDecimal(invoice.totalAmount, "totalAmount");
  const paid = toDecimal(invoice.amountPaid, "amountPaid");
  const left = total.minus(paid);
  return left.greaterThan(0) ? roundMoney(left) : ZERO;
}

export type AllocationInput = {
  supplierInvoiceId?: number;
  customerInvoiceId?: number;
  amount: Prisma.Decimal | number | string;
};

/**
 * Records a payment and applies it to invoices.
 *
 * Validates before writing anything: over-allocating a payment, or applying
 * more to an invoice than it still owes, fails the whole call rather than
 * leaving a half-applied payment behind.
 */
export async function recordPayment(input: {
  direction: PaymentDirection;
  method: PaymentMethod;
  reference?: string | null;
  paymentDate: Date;
  currencyCode: string;
  amount: Prisma.Decimal | number | string;
  supplierId?: number | null;
  accountId?: number | null;
  notes?: string | null;
  recordedById: number;
  allocations: AllocationInput[];
}) {
  const amount = roundMoney(toDecimal(input.amount, "amount"));
  if (amount.lessThanOrEqualTo(0)) {
    throw new DomainError("A payment must be for a positive amount.");
  }

  return prisma.$transaction(
    async tx => {
      let allocated = ZERO;

      // Lock every invoice this payment touches before reading any balance, in
      // a fixed order so two multi-invoice payments cannot deadlock on each
      // other. Nothing below this point can be read stale.
      const targets = input.allocations
        .map(line => ({
          side: (line.supplierInvoiceId
            ? "SUPPLIER"
            : "CUSTOMER") as InvoiceSide,
          id: line.supplierInvoiceId ?? line.customerInvoiceId,
        }))
        .filter((t): t is { side: InvoiceSide; id: number } => Boolean(t.id))
        .sort((a, b) =>
          a.side === b.side ? a.id - b.id : a.side.localeCompare(b.side)
        );
      for (const t of targets) {
        await lockInvoice(tx, t.side, t.id);
      }

      for (const line of input.allocations) {
        const lineAmount = roundMoney(
          toDecimal(line.amount, "allocation amount")
        );
        if (lineAmount.lessThanOrEqualTo(0)) {
          throw new DomainError("Each allocation must be a positive amount.");
        }
        const side: InvoiceSide = line.supplierInvoiceId
          ? "SUPPLIER"
          : "CUSTOMER";
        const invoiceId = line.supplierInvoiceId ?? line.customerInvoiceId;
        if (!invoiceId) {
          throw new DomainError(
            "Each allocation must name a supplier or customer invoice."
          );
        }
        // Direction and invoice side must agree, or the ledger says money left
        // the business to settle something a customer owed us.
        if (side === "SUPPLIER" && input.direction !== "OUTGOING") {
          throw new DomainError(
            "A supplier invoice can only be settled by an outgoing payment."
          );
        }
        if (side === "CUSTOMER" && input.direction !== "INCOMING") {
          throw new DomainError(
            "A customer invoice can only be settled by an incoming payment."
          );
        }

        const invoice = (await invoiceDelegate(tx, side).findUnique({
          where: { id: invoiceId },
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            amountPaid: true,
            status: true,
            currencyCode: true,
          },
        })) as {
          id: number;
          invoiceNumber: string;
          totalAmount: Prisma.Decimal;
          amountPaid: Prisma.Decimal;
          status: InvoiceStatus;
          currencyCode: string;
        } | null;
        if (!invoice) throw new NotFoundError("Invoice");
        if (
          invoice.status === "CANCELLED" ||
          invoice.status === "WRITTEN_OFF"
        ) {
          throw new DomainError(
            `${invoice.invoiceNumber} is ${invoice.status.toLowerCase().replace("_", " ")} and cannot take a payment.`
          );
        }
        if (invoice.currencyCode !== input.currencyCode) {
          throw new DomainError(
            `${invoice.invoiceNumber} is in ${invoice.currencyCode}; this payment is in ${input.currencyCode}. Settle it in its own currency.`
          );
        }
        const left = outstandingOf(invoice);
        if (lineAmount.greaterThan(left)) {
          throw new DomainError(
            `${invoice.invoiceNumber} has ${left.toFixed(2)} outstanding; cannot apply ${lineAmount.toFixed(2)}.`
          );
        }

        allocated = allocated.plus(lineAmount);
      }

      if (allocated.greaterThan(amount)) {
        throw new DomainError(
          `Allocations total ${allocated.toFixed(2)}, which is more than the payment of ${amount.toFixed(2)}.`
        );
      }

      // Drawn inside this transaction so a rejected payment does not consume a
      // payment number.
      const paymentNumber = await nextDocumentNumber(tx, SEQUENCE_KEYS.PAYMENT);

      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          direction: input.direction,
          method: input.method,
          reference: input.reference ?? null,
          paymentDate: input.paymentDate,
          currencyCode: input.currencyCode,
          amount,
          unallocated: roundMoney(amount.minus(allocated)),
          supplierId: input.supplierId ?? null,
          accountId: input.accountId ?? null,
          notes: input.notes ?? null,
          recordedById: input.recordedById,
        },
      });

      for (const line of input.allocations) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            supplierInvoiceId: line.supplierInvoiceId ?? null,
            customerInvoiceId: line.customerInvoiceId ?? null,
            amount: roundMoney(toDecimal(line.amount, "allocation amount")),
          },
        });
        if (line.supplierInvoiceId)
          await refreshInvoice(tx, "SUPPLIER", line.supplierInvoiceId);
        if (line.customerInvoiceId)
          await refreshInvoice(tx, "CUSTOMER", line.customerInvoiceId);
      }

      return tx.payment.findUnique({
        where: { id: payment.id },
        include: {
          allocations: {
            include: {
              supplierInvoice: { select: { invoiceNumber: true } },
              customerInvoice: { select: { invoiceNumber: true } },
            },
          },
          supplier: { select: { id: true, code: true, name: true } },
          account: { select: { id: true, name: true } },
        },
      });
    },
    // Payments on the same invoice queue behind one another on the advisory
    // lock. The default 5s window is not enough for a queue of them, and a
    // legitimate payment timing out is as bad as one being lost.
    { timeout: 60_000, maxWait: 10_000 }
  );
}

/** Ageing buckets, in days overdue. */
export const AGEING_BUCKETS = [
  { key: "current", label: "Not due", from: -Infinity, to: 0 },
  { key: "d1_30", label: "1–30 days", from: 1, to: 30 },
  { key: "d31_60", label: "31–60 days", from: 31, to: 60 },
  { key: "d61_90", label: "61–90 days", from: 61, to: 90 },
  { key: "d90_plus", label: "Over 90 days", from: 91, to: Infinity },
] as const;

export function bucketFor(dueDate: Date, asOf = new Date()) {
  const days = Math.floor(
    (asOf.getTime() - new Date(dueDate).getTime()) / 86_400_000
  );
  const bucket =
    AGEING_BUCKETS.find(b => days >= b.from && days <= b.to) ??
    AGEING_BUCKETS[0];
  return { days, bucket: bucket.key as string, label: bucket.label };
}
