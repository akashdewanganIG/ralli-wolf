import {
  InvoiceStatus,
  PaymentDirection,
  PaymentMethod,
  Prisma,
} from "@prisma/client";
import { prisma } from "@repo/db";

import {
  ZERO,
  requirePositive,
  roundMoney,
  toDecimal,
} from "../supplyChain/decimal.js";
import { DomainError, NotFoundError } from "../supplyChain/errors.js";
import {
  SEQUENCE_KEYS,
  nextDocumentNumber,
} from "../supplyChain/numbering.service.js";

const CLOSED: InvoiceStatus[] = ["PAID", "CANCELLED", "WRITTEN_OFF"];

export type InvoiceSide = "SUPPLIER" | "CUSTOMER";

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

function invoiceDelegate(
  tx: Prisma.TransactionClient,
  side: InvoiceSide
): InvoiceDelegate {
  return (side === "SUPPLIER"
    ? tx.supplierInvoice
    : tx.customerInvoice) as unknown as InvoiceDelegate;
}

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
      status = "APPROVED";
    }
  }

  await delegate.update({
    where: { id: invoiceId },
    data: { amountPaid: paid, status },
  });

  return { paid, total, outstanding: roundMoney(total.minus(paid)), status };
}

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

export type NormalizedPaymentAllocation = {
  side: InvoiceSide;
  invoiceId: number;
  amount: Prisma.Decimal;
};

export function normalizePaymentAllocations(
  input: readonly AllocationInput[]
): NormalizedPaymentAllocation[] {
  const grouped = new Map<string, NormalizedPaymentAllocation>();

  input.forEach((line, index) => {
    const hasSupplier = line.supplierInvoiceId !== undefined;
    const hasCustomer = line.customerInvoiceId !== undefined;
    if (hasSupplier === hasCustomer) {
      throw new DomainError(
        `Allocation ${index + 1} must name exactly one supplier or customer invoice.`
      );
    }

    const side: InvoiceSide = hasSupplier ? "SUPPLIER" : "CUSTOMER";
    const invoiceId = hasSupplier
      ? line.supplierInvoiceId
      : line.customerInvoiceId;
    if (!Number.isSafeInteger(invoiceId) || (invoiceId as number) <= 0) {
      throw new DomainError(
        `Allocation ${index + 1} has an invalid invoice id.`
      );
    }

    const lineAmount = roundMoney(
      requirePositive(line.amount, `allocations[${index}].amount`)
    );
    const key = `${side}:${invoiceId}`;
    const existing = grouped.get(key);
    grouped.set(key, {
      side,
      invoiceId: invoiceId as number,
      amount: existing ? existing.amount.plus(lineAmount) : lineAmount,
    });
  });

  return [...grouped.values()];
}

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
  const amount = roundMoney(requirePositive(input.amount, "amount"));
  if (input.supplierId && input.accountId) {
    throw new DomainError(
      "A payment cannot belong to both a supplier and a customer account."
    );
  }
  if (input.direction === "OUTGOING" && input.accountId) {
    throw new DomainError(
      "An outgoing payment cannot name a customer account."
    );
  }
  if (input.direction === "INCOMING" && input.supplierId) {
    throw new DomainError("An incoming payment cannot name a supplier.");
  }

  const allocations = normalizePaymentAllocations(input.allocations);

  return prisma.$transaction(
    async tx => {
      let allocated = ZERO;
      let supplierId = input.supplierId ?? null;
      let accountId = input.accountId ?? null;

      const targets = allocations
        .map(line => ({ side: line.side, id: line.invoiceId }))
        .sort((a, b) =>
          a.side === b.side ? a.id - b.id : a.side.localeCompare(b.side)
        );
      for (const t of targets) {
        await lockInvoice(tx, t.side, t.id);
      }

      for (const line of allocations) {
        const { side, invoiceId, amount: lineAmount } = line;

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
            ...(side === "SUPPLIER"
              ? { supplierId: true }
              : { accountId: true }),
          },
        })) as {
          id: number;
          invoiceNumber: string;
          totalAmount: Prisma.Decimal;
          amountPaid: Prisma.Decimal;
          status: InvoiceStatus;
          currencyCode: string;
          supplierId?: number;
          accountId?: number;
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
        if (side === "SUPPLIER") {
          if (!invoice.supplierId) {
            throw new DomainError(
              `${invoice.invoiceNumber} has no supplier association.`
            );
          }
          if (supplierId !== null && supplierId !== invoice.supplierId) {
            throw new DomainError(
              `${invoice.invoiceNumber} belongs to a different supplier.`
            );
          }
          supplierId = invoice.supplierId;
        } else {
          if (!invoice.accountId) {
            throw new DomainError(
              `${invoice.invoiceNumber} has no customer account association.`
            );
          }
          if (accountId !== null && accountId !== invoice.accountId) {
            throw new DomainError(
              `${invoice.invoiceNumber} belongs to a different customer account.`
            );
          }
          accountId = invoice.accountId;
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
      if (input.direction === "OUTGOING" && supplierId === null) {
        throw new DomainError(
          "An outgoing payment must identify the supplier receiving it."
        );
      }
      if (input.direction === "INCOMING" && accountId === null) {
        throw new DomainError(
          "An incoming payment must identify the customer account paying it."
        );
      }

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
          supplierId,
          accountId,
          notes: input.notes ?? null,
          recordedById: input.recordedById,
        },
      });

      for (const line of allocations) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            supplierInvoiceId: line.side === "SUPPLIER" ? line.invoiceId : null,
            customerInvoiceId: line.side === "CUSTOMER" ? line.invoiceId : null,
            amount: line.amount,
          },
        });
        await refreshInvoice(tx, line.side, line.invoiceId);
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

    { timeout: 60_000, maxWait: 10_000 }
  );
}

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
