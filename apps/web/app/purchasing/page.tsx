"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  ErrorBanner,
  PageHeader,
  Panel,
  SimpleTable,
  StatCard,
  StatusBadge,
} from "@/components/supply-chain/shared";
import { WarehouseFilter } from "@/components/supply-chain/WarehouseFilter";
import {
  useDeliveryWatchlist,
  usePurchasingDashboard,
  useSupplierScorecards,
} from "@/hooks/useSupplyChain";
import {
  formatDate,
  formatMoney,
  formatPercent,
  formatQuantity,
} from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { CardActionButton } from "@repo/ui/components/ui/card-action-button";
import { Tag } from "@repo/ui/components/ui/tag";

export default function PurchasingDashboardPage() {
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const { data, isLoading, error } = usePurchasingDashboard({ warehouseId });
  const { data: watchlistData, isLoading: watchlistLoading } =
    useDeliveryWatchlist({ warehouseId, daysAhead: 14 });
  const { data: scorecardData, isLoading: scorecardLoading } =
    useSupplierScorecards({ limit: 10 });

  const dashboard = data?.data;
  const watchlist = watchlistData?.data;
  const scorecards = scorecardData?.data;

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Purchasing & suppliers"
          subtitle="What you are buying, what has arrived, and how your suppliers are doing."
          actions={
            <>
              <WarehouseFilter
                value={warehouseId}
                onChange={setWarehouseId}
                className="w-full sm:w-56"
              />
              <Button asChild className="whitespace-nowrap">
                <Link href="/purchasing/orders">Purchase orders</Link>
              </Button>
            </>
          }
        />

        <ErrorBanner error={error} />

        <div className="grid-auto-fit gap-3">
          <StatCard
            label="Spend (last 30 days)"
            value={isLoading ? "—" : formatMoney(dashboard?.spendLast30Days)}
            hint={`${dashboard?.suppliersOrderedFromLast30Days ?? 0} supplier(s) used`}
          />
          <StatCard
            label="Open commitment"
            value={
              isLoading ? "—" : formatMoney(dashboard?.openCommitmentValue)
            }
            hint="Approved but not yet received"
            tone="info"
          />
          <StatCard
            label="Overdue deliveries"
            value={isLoading ? "—" : (dashboard?.overdueOrders ?? 0)}
            tone={dashboard?.overdueOrders ? "critical" : "positive"}
            href="/purchasing/orders?status=SENT"
          />
          <StatCard
            label="Receipts awaiting QC"
            value={isLoading ? "—" : (dashboard?.receiptsPendingQc ?? 0)}
            tone={dashboard?.receiptsPendingQc ? "warning" : "positive"}
            href="/purchasing/goods-receipts"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              href: "/purchasing/suppliers",
              label: "Suppliers",
              hint: `${dashboard?.activeSuppliers ?? 0} active`,
            },
            {
              href: "/purchasing/requisitions",
              label: "Requisitions",
              hint: `${dashboard?.openRequisitions ?? 0} open`,
            },
            {
              href: "/purchasing/orders",
              label: "Purchase orders",
              hint: "Raise, approve and track",
            },
            {
              href: "/purchasing/goods-receipts",
              label: "Goods receipts",
              hint: "GRN and putaway",
            },
            {
              href: "/purchasing/quality",
              label: "Quality checks",
              hint: "Inspection results",
            },
          ].map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="text-sm font-medium">{link.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{link.hint}</p>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel flush title="Orders by status">
            <SimpleTable
              isLoading={isLoading}
              rows={dashboard?.ordersByStatus ?? []}
              keyOf={row => row.status}
              empty="No purchase orders yet."
              columns={[
                {
                  header: "Status",
                  cell: row => <StatusBadge status={row.status} />,
                },
                { header: "Orders", align: "right", cell: row => row.count },
                {
                  header: "Value",
                  align: "right",
                  cell: row => formatMoney(row.value),
                },
              ]}
            />
          </Panel>

          <Panel
            flush
            title="Delivery watchlist"
            description="Orders arriving in the next two weeks, plus anything already overdue."
            actions={
              watchlist && watchlist.overdue > 0 ? (
                <Tag tone="danger">{watchlist.overdue} overdue</Tag>
              ) : null
            }
          >
            <SimpleTable
              isLoading={watchlistLoading}
              rows={watchlist?.rows ?? []}
              keyOf={row => row.id}
              empty="Nothing due in the next two weeks."
              rowClassName={row => (row.isOverdue ? "bg-error-surface/40" : "")}
              columns={[
                {
                  header: "PO",
                  cell: row => (
                    <Link
                      href={`/purchasing/orders/${row.id}`}
                      className="font-mono text-xs text-primary hover:text-info"
                    >
                      {row.poNumber}
                    </Link>
                  ),
                },
                { header: "Supplier", cell: row => row.supplier.name },
                { header: "Due", cell: row => formatDate(row.dueDate) },
                {
                  header: "Late by",
                  align: "right",
                  cell: row =>
                    row.isOverdue ? (
                      <span className="font-semibold text-error-foreground">
                        {row.daysLate}d
                      </span>
                    ) : (
                      "—"
                    ),
                },
                {
                  header: "Outstanding",
                  align: "right",
                  cell: row => formatQuantity(row.outstandingQuantity),
                },
                {
                  header: "Complete",
                  align: "right",
                  cell: row => formatPercent(row.completionPercent),
                },
              ]}
            />
          </Panel>
        </div>

        <Panel
          flush
          title="Supplier scorecards"
          description="How well each supplier performed over the past year. Suppliers you did not buy from are left out rather than scored zero."
          footerAction={
            <CardActionButton href="/purchasing/suppliers">
              All suppliers
            </CardActionButton>
          }
        >
          <SimpleTable
            isLoading={scorecardLoading}
            rows={scorecards?.suppliers ?? []}
            keyOf={row => row.supplierId}
            empty="No supplier has enough posted activity to be scored yet."
            columns={[
              {
                header: "Supplier",
                cell: row => (
                  <Link
                    href={`/purchasing/suppliers/${row.supplierId}`}
                    className="text-primary hover:text-info"
                  >
                    <span className="font-mono text-xs">
                      {row.supplierCode}
                    </span>
                    <span className="ml-2 text-sm">{row.supplierName}</span>
                  </Link>
                ),
              },
              {
                header: "Orders",
                align: "right",
                cell: row => row.totalOrders,
              },
              {
                header: "Order value",
                align: "right",
                cell: row => formatMoney(row.totalOrderValue),
              },
              {
                header: "On time",
                align: "right",
                cell: row => (
                  <span
                    className={
                      Number(row.onTimeDeliveryRate) < 80
                        ? "font-semibold text-error-foreground"
                        : "text-success-foreground"
                    }
                  >
                    {formatPercent(row.onTimeDeliveryRate)}
                  </span>
                ),
              },
              {
                header: "Quality",
                align: "right",
                cell: row => (
                  <span
                    className={
                      Number(row.qualityAcceptanceRate) < 95
                        ? "font-semibold text-warning-foreground"
                        : "text-success-foreground"
                    }
                  >
                    {formatPercent(row.qualityAcceptanceRate)}
                  </span>
                ),
              },
              {
                header: "Fill rate",
                align: "right",
                cell: row => formatPercent(row.fillRate),
              },
              {
                header: "Avg lead time",
                align: "right",
                cell: row => `${formatQuantity(row.averageLeadTimeDays, 1)}d`,
              },
              {
                header: "Price variance",
                align: "right",
                cell: row => formatPercent(row.priceVariancePercent, 2),
              },
              {
                header: "Score",
                align: "right",
                cell: row => (
                  <span
                    className={`font-semibold ${
                      Number(row.overallScore) >= 85
                        ? "text-success-foreground"
                        : Number(row.overallScore) >= 70
                          ? "text-warning-foreground"
                          : "text-error-foreground"
                    }`}
                  >
                    {formatQuantity(row.overallScore, 1)}
                  </span>
                ),
              },
            ]}
          />
          {scorecards && (
            <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
              Score weighting: on-time delivery{" "}
              {Math.round((scorecards.weights.onTimeDelivery ?? 0) * 100)}%,
              quality {Math.round((scorecards.weights.quality ?? 0) * 100)}%,
              fill rate {Math.round((scorecards.weights.fillRate ?? 0) * 100)}%,
              price stability{" "}
              {Math.round((scorecards.weights.priceStability ?? 0) * 100)}%.
            </p>
          )}
        </Panel>
      </PageShell>
    </ProtectedRoute>
  );
}
