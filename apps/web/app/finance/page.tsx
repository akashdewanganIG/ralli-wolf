"use client";

import * as React from "react";
import Link from "next/link";

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
import { useFinanceDashboard } from "@/hooks/useFinance";
import { formatDate, formatMoney } from "@/lib/utils/decimal";

/** A single ageing profile, drawn as proportional bars. */
function Ageing({
  title,
  buckets,
  currencyCode,
}: {
  title: string;
  buckets: Record<string, { label: string; amount: string; count: number }>;
  currencyCode: string;
}) {
  const rows = Object.values(buckets);
  const max = Math.max(...rows.map(r => Number(r.amount)), 1);

  return (
    <div className="space-y-2">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </p>
      {rows.map(row => {
        const amount = Number(row.amount);
        // "Not due" is the healthy bucket; everything after it is late, and
        // gets progressively more attention.
        const overdue = row.label !== "Not due";
        return (
          <div key={row.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-muted-foreground">
              {row.label}
            </span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-secondary">
              <div
                className={
                  overdue
                    ? "h-full rounded-full bg-primary"
                    : "h-full rounded-full bg-success"
                }
                style={{
                  width: `${Math.max((amount / max) * 100, amount > 0 ? 4 : 0)}%`,
                }}
              />
            </div>
            <span className="w-28 shrink-0 text-right text-xs tabular-nums text-foreground">
              {formatMoney(row.amount, currencyCode)}
            </span>
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {row.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function FinancePage() {
  const { data, isLoading, isError } = useFinanceDashboard();
  // Without data there is nothing honest to put in a figure, and a failed
  // request is no more informative than one still in flight. Every figure on
  // this page therefore keys off `d` itself rather than off a status flag.
  const d = data?.data;

  // Currencies with open invoices that the headline figures do not speak for.
  const mixed = React.useMemo(() => {
    if (!d) return [];
    const all = new Set([
      ...d.payables.currencies,
      ...d.receivables.currencies,
    ]);
    all.delete(d.payables.currencyCode);
    all.delete(d.receivables.currencyCode);
    return [...all].sort();
  }, [d]);

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Finance"
          subtitle="What you owe suppliers, what customers owe you, and what has been paid."
        />

        {isError && (
          <ErrorBanner
            error={{ message: "The finance overview could not be loaded." }}
          />
        )}

        <div className="grid-auto-fit gap-3">
          <StatCard
            label="Owed to suppliers"
            value={formatMoney(
              d?.payables.outstanding,
              d?.payables.currencyCode
            )}
            hint={d ? `${d.payables.openCount} open invoice(s)` : "—"}
            tone={Number(d?.payables.overdue ?? 0) > 0 ? "critical" : "neutral"}
          />
          <StatCard
            label="Owed by customers"
            value={formatMoney(
              d?.receivables.outstanding,
              d?.receivables.currencyCode
            )}
            hint={d ? `${d.receivables.openCount} open invoice(s)` : "—"}
            tone="info"
          />
          <StatCard
            label="Overdue to pay"
            value={formatMoney(d?.payables.overdue, d?.payables.currencyCode)}
            hint={d ? `${d.payables.overdueCount} past their due date` : "—"}
            tone={
              Number(d?.payables.overdue ?? 0) > 0 ? "critical" : "positive"
            }
          />
          <StatCard
            label="Overdue to collect"
            value={formatMoney(
              d?.receivables.overdue,
              d?.receivables.currencyCode
            )}
            hint={d ? `${d.receivables.overdueCount} past their due date` : "—"}
            tone={
              Number(d?.receivables.overdue ?? 0) > 0 ? "warning" : "positive"
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="Ageing"
            description="How overdue the money is. Anything past 'Not due' needs chasing or paying."
          >
            <div className="space-y-5">
              {d ? (
                <>
                  <Ageing
                    title="Payables — what we owe"
                    buckets={d.payables.ageing}
                    currencyCode={d.payables.currencyCode}
                  />
                  <Ageing
                    title="Receivables — what we are owed"
                    buckets={d.receivables.ageing}
                    currencyCode={d.receivables.currencyCode}
                  />
                  {mixed.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      These figures are in {d.payables.currencyCode}. Invoices
                      in {mixed.join(", ")} are held separately — money in
                      different currencies is never added together.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isLoading
                    ? "Loading…"
                    : isError
                      ? "The ageing profile could not be loaded."
                      : "Nothing outstanding."}
                </p>
              )}
            </div>
          </Panel>

          <Panel
            title="Cash movement"
            description="Money that actually left or arrived in the last 30 days."
          >
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard
                  label="Paid out"
                  value={formatMoney(
                    d?.last30Days.paidOut.amount,
                    d?.last30Days.paidOut.currencyCode
                  )}
                  hint={d ? `${d.last30Days.paidOut.count} payment(s)` : "—"}
                  tone="critical"
                />
                <StatCard
                  label="Received in"
                  value={formatMoney(
                    d?.last30Days.receivedIn.amount,
                    d?.last30Days.receivedIn.currencyCode
                  )}
                  hint={d ? `${d.last30Days.receivedIn.count} payment(s)` : "—"}
                  tone="positive"
                />
              </div>
              <div className="rounded-lg border border-border bg-surface-secondary p-3">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Net position
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {d && d.netPosition === null
                    ? "—"
                    : formatMoney(
                        d?.netPosition,
                        d?.netPositionCurrency ?? undefined
                      )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {d && d.netPosition === null
                    ? "What you owe and what you are owed are in different currencies, so there is no single figure to give."
                    : Number(d?.netPosition ?? 0) >= 0
                      ? "Customers owe you more than you owe suppliers."
                      : "You owe suppliers more than customers owe you."}
                </p>
              </div>
            </div>
          </Panel>
        </div>

        <Panel
          flush
          title="Recent payments"
          description="The last few movements of money, in or out."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/finance/payables"
                className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-[0.8125rem] font-medium text-foreground transition-colors hover:bg-hover"
              >
                Payables
              </Link>
              <Link
                href="/finance/payments"
                className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-[0.8125rem] font-medium text-foreground transition-colors hover:bg-hover"
              >
                All payments
              </Link>
              <Link
                href="/finance/receivables"
                className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-[0.8125rem] font-medium text-foreground transition-colors hover:bg-hover"
              >
                Receivables
              </Link>
            </div>
          }
        >
          <SimpleTable
            isLoading={isLoading}
            rows={d?.recentPayments ?? []}
            keyOf={row => row.id}
            empty={
              isError
                ? "Recent payments could not be loaded."
                : "No payments recorded yet."
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
