import { prisma } from "@repo/db";
import { Prisma, type InvoiceStatus } from "@prisma/client";
import { roleHasPermission } from "@repo/db/permissions";

import { createNotification } from "../controllers/notification.controller.js";
import { outstandingOf } from "../services/finance/finance.service.js";
import { runWithSchedulerLease } from "./scheduler-lease.js";
import { logError, logInfo } from "../utils/logger.js";

const OPEN: InvoiceStatus[] = [
  "DRAFT",
  "AWAITING_APPROVAL",
  "APPROVED",
  "PARTIALLY_PAID",
];

let sweepInFlight = false;

const FINANCE_OVERDUE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function runOverdueInvoiceSweep(): Promise<void> {
  if (sweepInFlight) {
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

    const activeUsers = await prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, role: true, permissions: true },
    });
    const recipients = activeUsers.filter(user =>
      roleHasPermission(user.role, user.permissions, "finance.view")
    );

    const count = latePayables.length + lateReceivables.length;
    const sweepDay = now.toISOString().slice(0, 10);
    const deliveries = await Promise.allSettled(
      recipients.map(recipient =>
        createNotification({
          userId: recipient.id,
          type: "INVOICE_OVERDUE",
          title: `${count} overdue invoice${count === 1 ? "" : "s"} — ${totals} outstanding`,
          message: `${detail}. Open the ledger to see the full ageing.`,
          link: "/finance",
          dedupeKey: `finance-overdue:${sweepDay}:user:${recipient.id}`,
          awaitEmailDelivery: true,
        })
      )
    );
    const failed = deliveries.filter(result => result.status === "rejected");
    logInfo("finance_overdue_sweep_completed", {
      invoiceCount: count,
      recipientCount: recipients.length,
      failedRecipientCount: failed.length,
    });
  } catch (error) {
    logError("finance_overdue_sweep_failed", error);
  } finally {
    sweepInFlight = false;
  }
}

export function startFinanceSchedulers(): void {
  const run = () =>
    runWithSchedulerLease(
      "finance-overdue-invoices",
      2 * 60 * 60_000,
      runOverdueInvoiceSweep
    ).catch(error => logError("finance_scheduler_lease_failed", error));
  void run();
  const timer = setInterval(() => void run(), FINANCE_OVERDUE_INTERVAL_MS);
  timer.unref();

  logInfo("finance_scheduler_started", {
    intervalMs: FINANCE_OVERDUE_INTERVAL_MS,
  });
}
