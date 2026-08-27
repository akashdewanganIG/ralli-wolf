import { prisma } from "@repo/db";
import { Prisma, UserRole, type InvoiceStatus } from "@prisma/client";

import { createNotification } from "../controllers/notification.controller.js";
import { outstandingOf } from "../services/finance/finance.service.js";

/** Statuses that still owe money. Mirrors the finance controller's `OPEN`. */
const OPEN: InvoiceStatus[] = [
  "DRAFT",
  "AWAITING_APPROVAL",
  "APPROVED",
  "PARTIALLY_PAID",
];

let sweepInFlight = false;

/**
 * How often the ledger is swept for invoices that have gone past due.
 *
 * Daily by default. This produces a message a person reads over morning
 * coffee, not an interruption: an invoice that went overdue at 3am is no more
 * urgent at 3am than at 9am.
 */
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * One digest listing everything overdue, rather than one message per invoice.
 *
 * The distinction matters at volume: a ledger with forty late invoices would
 * otherwise send forty emails, which is how a useful alert becomes a filter
 * rule. A single message that says how much is late, and names the worst of
 * it, is the one that still gets read in month three.
 */
export async function runOverdueInvoiceSweep(): Promise<void> {
  if (sweepInFlight) {
    console.log("[Finance] Previous overdue sweep still running; skipping");
    return;
  }
  sweepInFlight = true;

  try {
    const now = new Date();
    const [payables, receivables] = await Promise.all([
      prisma.supplierInvoice.findMany({
        where: { status: { in: OPEN }, dueDate: { lt: now } },
        select: {
          invoiceNumber: true,
          dueDate: true,
          currencyCode: true,
          totalAmount: true,
          amountPaid: true,
          status: true,
          supplier: { select: { name: true } },
        },
        orderBy: { dueDate: "asc" },
      }),
      prisma.customerInvoice.findMany({
        where: { status: { in: OPEN }, dueDate: { lt: now } },
        select: {
          invoiceNumber: true,
          dueDate: true,
          currencyCode: true,
          totalAmount: true,
          amountPaid: true,
          status: true,
          account: { select: { name: true } },
        },
        orderBy: { dueDate: "asc" },
      }),
    ]);

    // An invoice can sit in an open status with nothing actually left to pay;
    // those are not overdue, they are finished but not yet marked so.
    const owing = <
      T extends {
        totalAmount: Prisma.Decimal;
        amountPaid: Prisma.Decimal;
        status: InvoiceStatus;
      },
    >(
      rows: T[]
    ) => rows.filter(row => outstandingOf(row).greaterThan(0));

    const latePayables = owing(payables);
    const lateReceivables = owing(receivables);
    if (latePayables.length === 0 && lateReceivables.length === 0) return;

    const daysLate = (due: Date) =>
      Math.floor((now.getTime() - due.getTime()) / 86_400_000);

    // Totalled per currency, never across: adding 1000 USD to 1000 INR and
    // reporting 2000 is a wrong number, not a rounding one.
    const perCurrency = new Map<string, number>();
    for (const row of [...latePayables, ...lateReceivables]) {
      const left = Number(outstandingOf(row).toFixed(2));
      perCurrency.set(
        row.currencyCode,
        (perCurrency.get(row.currencyCode) ?? 0) + left
      );
    }
    const totals = [...perCurrency]
      .map(([code, amount]) => `${code} ${amount.toFixed(2)}`)
      .join(", ");

    const worstPayable = latePayables[0];
    const worstReceivable = lateReceivables[0];
    const detail = [
      latePayables.length
        ? `${latePayables.length} to pay${
            worstPayable
              ? ` — oldest ${worstPayable.invoiceNumber} to ${worstPayable.supplier.name}, ${daysLate(worstPayable.dueDate)} day(s) late`
              : ""
          }`
        : null,
      lateReceivables.length
        ? `${lateReceivables.length} to collect${
            worstReceivable
              ? ` — oldest ${worstReceivable.invoiceNumber} from ${worstReceivable.account.name}, ${daysLate(worstReceivable.dueDate)} day(s) late`
              : ""
          }`
        : null,
    ]
      .filter(Boolean)
      .join(". ");

    // Finance is an admin-only module, so the people who can act on this are
    // exactly the admins. Preferences still apply per person.
    const recipients = await prisma.user.findMany({
      where: { deletedAt: null, role: UserRole.ADMIN },
      select: { id: true },
    });

    const count = latePayables.length + lateReceivables.length;
    for (const recipient of recipients) {
      await createNotification({
        userId: recipient.id,
        type: "INVOICE_OVERDUE",
        title: `${count} overdue invoice${count === 1 ? "" : "s"} — ${totals} outstanding`,
        message: `${detail}. Open the ledger to see the full ageing.`,
        link: "/finance",
      });
    }

    console.log(
      `[Finance] Overdue sweep: ${count} invoice(s), notified ${recipients.length} admin(s)`
    );
  } catch (error) {
    console.error("[Finance] Overdue sweep failed:", error);
  } finally {
    sweepInFlight = false;
  }
}

/** Starts the daily ledger sweep. Interval is unref'd so it never holds shutdown. */
export function startFinanceSchedulers(): void {
  const intervalMs =
    Number(process.env.FINANCE_OVERDUE_INTERVAL_MS || "") ||
    DEFAULT_INTERVAL_MS;

  const timer = setInterval(() => {
    void runOverdueInvoiceSweep();
  }, intervalMs);
  timer.unref();

  console.log(
    `[Finance] Overdue invoice sweep every ${Math.round(intervalMs / 3_600_000)}h (FINANCE_OVERDUE_INTERVAL_MS)`
  );
}
