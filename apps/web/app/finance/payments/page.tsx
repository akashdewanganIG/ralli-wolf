"use client";

import * as React from "react";

import { Button } from "@repo/ui/components/ui/button";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { Tag } from "@repo/ui/components/ui/tag";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  ErrorBanner,
  PageHeader,
  Panel,
  SimpleTable,
  StatCard,
} from "@/components/supply-chain/shared";
import { usePayments } from "@/hooks/useFinance";
import { formatDate, formatMoney } from "@/lib/utils/decimal";
import { DataTransfer } from "@/components/data-transfer/DataTransfer";

const FILTERS = [
  { value: undefined, label: "Everything" },
  { value: "OUTGOING" as const, label: "Money out" },
  { value: "INCOMING" as const, label: "Money in" },
];

export default function PaymentsPage() {
  const [direction, setDirection] = React.useState<
    "OUTGOING" | "INCOMING" | undefined
  >(undefined);
  const { data, isLoading, error } = usePayments(
    direction ? { direction } : undefined
  );
  const unknown = isLoading || Boolean(error);

  const rows = data?.data;
  const payments = React.useMemo(() => rows ?? [], [rows]);

  // Payments carry their own currency; totalling across them would produce a
  // number that is not money. The headline is the busiest currency, and any
  // others are named instead of being folded in.
  const totals = React.useMemo(() => {
    const per = new Map<string, { out: number; inn: number; n: number }>();
    for (const p of payments) {
      const acc = per.get(p.currencyCode) ?? { out: 0, inn: 0, n: 0 };
      if (p.direction === "OUTGOING") acc.out += Number(p.amount);
      else acc.inn += Number(p.amount);
      acc.n += 1;
      per.set(p.currencyCode, acc);
    }
    const primary = [...per.entries()].sort((a, b) => b[1].n - a[1].n)[0];
    return {
      currencyCode: primary?.[0] ?? "INR",
      out: primary?.[1].out ?? 0,
      inn: primary?.[1].inn ?? 0,
      others: [...per.keys()].filter(c => c !== primary?.[0]).sort(),
    };
  }, [payments]);

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Payments"
          subtitle="Every movement of money, in or out, and which invoices each one settled."
          actions={<DataTransfer entity="payments" />}
        />

        <ErrorBanner error={error} />

        <div className="grid-auto-fit gap-3">
          <StatCard
            label="Payments shown"
            value={unknown ? "—" : String(payments.length)}
            hint={
              totals.others.length > 0
                ? `Most recent first; also ${totals.others.join(", ")}`
                : "Most recent first"
            }
            tone="neutral"
          />
          <StatCard
            label="Money out"
            value={
              unknown
                ? "—"
                : formatMoney(totals.out.toFixed(2), totals.currencyCode)
            }
            hint={
              totals.others.length > 0
                ? `Paid to suppliers, in ${totals.currencyCode}`
                : "Paid to suppliers"
            }
            tone="critical"
          />
          <StatCard
            label="Money in"
            value={
              unknown
                ? "—"
                : formatMoney(totals.inn.toFixed(2), totals.currencyCode)
            }
            hint={
              totals.others.length > 0
                ? `Received from customers, in ${totals.currencyCode}`
                : "Received from customers"
            }
            tone="positive"
          />
        </div>

        <Panel
          flush
          title="Payment history"
          description="A payment can settle more than one invoice; the invoices it was applied to are listed against it."
          actions={
            <div className="flex gap-2">
              {FILTERS.map(f => (
                <Button
                  key={f.label}
                  type="button"
                  size="sm"
                  variant={direction === f.value ? "default" : "outline"}
                  onClick={() => setDirection(f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          }
        >
          <SimpleTable
            isLoading={isLoading}
            rows={payments}
            keyOf={row => row.id}
            empty={
              error
                ? "Payments could not be loaded."
                : "No payments have been recorded yet."
            }
            columns={[
              { header: "Payment", cell: row => row.paymentNumber },
              {
                header: "Direction",
                cell: row => (
                  <Tag
                    tone={row.direction === "OUTGOING" ? "danger" : "active"}
                  >
                    {row.direction === "OUTGOING" ? "Paid out" : "Received"}
                  </Tag>
                ),
              },
              {
                header: "Party",
                cell: row => row.supplier?.name ?? row.account?.name ?? "—",
              },
              { header: "Method", cell: row => <Tag>{row.method}</Tag> },
              { header: "Reference", cell: row => row.reference ?? "—" },
              {
                header: "Applied to",
                cell: row => {
                  const names = (row.allocations ?? []).map(
                    a =>
                      a.supplierInvoice?.invoiceNumber ??
                      a.customerInvoice?.invoiceNumber ??
                      "—"
                  );
                  return names.length > 0
                    ? names.join(", ")
                    : "Not yet applied";
                },
              },
              {
                header: "Recorded by",
                cell: row =>
                  row.recordedBy
                    ? `${row.recordedBy.firstName ?? ""} ${row.recordedBy.lastName ?? ""}`.trim() ||
                      "—"
                    : "—",
              },
              { header: "Date", cell: row => formatDate(row.paymentDate) },
              {
                header: "Amount",
                align: "right",
                cell: row => formatMoney(row.amount, row.currencyCode),
              },
            ]}
          />
        </Panel>
      </PageShell>
    </ProtectedRoute>
  );
}
