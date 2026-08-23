"use client";

import { useMemo, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { useParams } from "next/navigation";
import { Alert } from "@repo/ui/components/ui/alert";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  DetailRow,
  ErrorBanner,
  PageHeader,
  Panel,
  SimpleTable,
  StatCard,
  StatusBadge,
} from "@/components/supply-chain/shared";
import { useInventoryMutations, useStockCount } from "@/hooks/useSupplyChain";
import {
  formatDateTime,
  formatMoney,
  formatQuantity,
  humanizeEnum,
} from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";

export default function StockCountDetailPage() {
  const params = useParams<{ id: string }>();
  const countId = Number(params.id);
  const { data, isLoading, error } = useStockCount(countId);
  const { recordCountLines, postCount } = useInventoryMutations();

  /** Draft counted quantities, keyed by line id, before they are saved. */
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [reasonCodes, setReasonCodes] = useState<Record<number, string>>({});

  const count = data?.data;
  const lines = useMemo(() => count?.lines ?? [], [count?.lines]);
  const isClosed =
    count?.status === "COMPLETED" || count?.status === "CANCELLED";

  const stats = useMemo(() => {
    const counted = lines.filter(line => line.countedQuantity !== null).length;
    const variances = lines.filter(line => Number(line.varianceQuantity) !== 0);
    const netValue = variances.reduce(
      (acc, line) => acc + Number(line.varianceValue),
      0
    );
    return {
      counted,
      total: lines.length,
      varianceCount: variances.length,
      netValue,
    };
  }, [lines]);

  const dirtyLines = Object.entries(draft)
    .filter(([, value]) => value !== "")
    .map(([lineId, value]) => ({
      lineId: Number(lineId),
      countedQuantity: value,
      reasonCode: reasonCodes[Number(lineId)] || undefined,
    }));

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title={count ? `Count ${count.countNumber}` : "Stock count"}
          subtitle={
            count
              ? `${humanizeEnum(count.countType)} count in ${count.warehouse?.code ?? ""} · ${stats.counted} of ${stats.total} line(s) counted`
              : undefined
          }
          breadcrumb={[
            { label: "Inventory", href: "/inventory" },
            { label: "Counts", href: "/inventory/counts" },
            { label: count?.countNumber ?? String(countId) },
          ]}
          actions={
            count && (
              <div className="flex items-center gap-2">
                <StatusBadge status={count.status} />
                {!isClosed && (
                  <>
                    <Button
                      type="button"
                      disabled={
                        dirtyLines.length === 0 || recordCountLines.isPending
                      }
                      onClick={() =>
                        recordCountLines.mutate(
                          { id: countId, lines: dirtyLines },
                          { onSuccess: () => setDraft({}) }
                        )
                      }
                      variant="outline"
                      className="px-3 whitespace-nowrap"
                    >
                      {recordCountLines.isPending
                        ? "Saving…"
                        : `Save ${dirtyLines.length || ""} counted line(s)`}
                    </Button>
                    <Button
                      type="button"
                      disabled={postCount.isPending || stats.counted === 0}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Post this count? ${stats.varianceCount} line(s) with a variance will be written on or off stock, and the ledger will record the adjustment. This cannot be undone.`
                          )
                        ) {
                          postCount.mutate({ id: countId });
                        }
                      }}
                      className="px-3 whitespace-nowrap"
                    >
                      {postCount.isPending
                        ? "Posting…"
                        : "Post variances to stock"}
                    </Button>
                  </>
                )}
              </div>
            )
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={recordCountLines.error} />
        <ErrorBanner error={postCount.error} />

        {postCount.isSuccess && (
          <Alert tone="success" title="Count posted">
            Variances have been written to stock and appear in the ledger as
            cycle-count gains and losses.
          </Alert>
        )}

        <div className="grid-auto-fit gap-3">
          <StatCard label="Lines" value={stats.total} />
          <StatCard
            label="Counted"
            value={`${stats.counted} / ${stats.total}`}
            tone={stats.counted === stats.total ? "positive" : "neutral"}
          />
          <StatCard
            label="Lines with variance"
            value={stats.varianceCount}
            tone={stats.varianceCount ? "warning" : "positive"}
          />
          <StatCard
            label="Net variance value"
            value={formatMoney(stats.netValue)}
            tone={
              stats.netValue < 0
                ? "critical"
                : stats.netValue > 0
                  ? "info"
                  : "neutral"
            }
          />
        </div>

        {count && (
          <Panel title="Count details">
            <div className="grid-auto-fit gap-4">
              <DetailRow
                label="Warehouse"
                value={
                  count.warehouse
                    ? `${count.warehouse.code} — ${count.warehouse.name}`
                    : "—"
                }
              />
              <DetailRow
                label="Started"
                value={formatDateTime(count.startedAt)}
              />
              <DetailRow
                label="Completed"
                value={formatDateTime(count.completedAt)}
              />
              <DetailRow
                label="Counted by"
                value={
                  count.countedBy
                    ? `${count.countedBy.firstName ?? ""} ${count.countedBy.lastName ?? ""}`.trim()
                    : "—"
                }
              />
              {count.notes && <DetailRow label="Notes" value={count.notes} />}
            </div>
          </Panel>
        )}

        <Panel
          title="Count sheet"
          description={
            isClosed
              ? "This count is closed and read only."
              : "Enter the quantity physically found in each location, then save."
          }
        >
          <SimpleTable
            isLoading={isLoading}
            rows={lines}
            keyOf={row => row.id}
            empty="This count sheet has no lines."
            rowClassName={row =>
              Number(row.varianceQuantity) !== 0 ? "bg-warning-surface/40" : ""
            }
            columns={[
              {
                header: "Item",
                cell: row => (
                  <div>
                    <p className="font-mono text-xs text-primary">
                      {row.product.code}
                    </p>
                    <p className="text-sm">{row.product.name}</p>
                  </div>
                ),
              },
              {
                header: "Bin",
                cell: row => (
                  <span className="font-mono text-xs">{row.bin.code}</span>
                ),
              },
              {
                header: "Lot",
                cell: row => (
                  <span className="font-mono text-xs">
                    {row.lot?.lotNumber ?? "—"}
                  </span>
                ),
              },
              {
                header: "System qty",
                align: "right",
                cell: row => formatQuantity(row.systemQuantity),
              },
              {
                header: "Counted qty",
                align: "right",
                cell: row =>
                  isClosed || row.isPosted ? (
                    formatQuantity(row.countedQuantity)
                  ) : (
                    <Input
                      className="w-28 text-right"
                      inputMode="decimal"
                      placeholder={
                        row.countedQuantity !== null
                          ? String(row.countedQuantity)
                          : "—"
                      }
                      value={draft[row.id] ?? ""}
                      onChange={event =>
                        setDraft(current => ({
                          ...current,
                          [row.id]: event.target.value,
                        }))
                      }
                    />
                  ),
              },
              {
                header: "Variance",
                align: "right",
                cell: row => {
                  const variance = Number(row.varianceQuantity);
                  if (variance === 0)
                    return <span className="text-muted-foreground">—</span>;
                  return (
                    <span
                      className={
                        variance > 0
                          ? "font-semibold text-success-foreground"
                          : "font-semibold text-error-foreground"
                      }
                    >
                      {variance > 0 ? "+" : ""}
                      {formatQuantity(row.varianceQuantity)}
                    </span>
                  );
                },
              },
              {
                header: "Variance value",
                align: "right",
                cell: row => formatMoney(row.varianceValue),
              },
              {
                header: "Reason",
                cell: row =>
                  isClosed || row.isPosted ? (
                    (row.reasonCode ?? "—")
                  ) : (
                    <Input
                      className="w-32"
                      placeholder="e.g. DAMAGE"
                      value={reasonCodes[row.id] ?? row.reasonCode ?? ""}
                      onChange={event =>
                        setReasonCodes(current => ({
                          ...current,
                          [row.id]: event.target.value,
                        }))
                      }
                    />
                  ),
              },
              {
                header: "Posted",
                cell: row =>
                  row.isPosted ? (
                    <span className="text-xs font-medium text-success-foreground">
                      Yes
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No</span>
                  ),
              },
            ]}
          />
        </Panel>
      </PageShell>
    </ProtectedRoute>
  );
}
