"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { Alert } from "@repo/ui/components/ui/alert";
import { ProtectedRoute } from "@/components/protected-route";
import {
  PageHeader,
  Panel,
  StatCard,
  SimpleTable,
  ErrorBanner,
  EmptyState,
  PanelInset,
} from "@/components/supply-chain/shared";
import { WarehouseFilter } from "@/components/supply-chain/warehouse-filter";
import {
  useInventoryDashboard,
  useInventoryMutations,
  useStockAlerts,
  useWarehouses,
} from "@/hooks/use-supply-chain";
import { formatMoney, formatQuantity, humanizeEnum } from "@/lib/utils/decimal";
import { SeverityBadge } from "@/components/supply-chain/shared";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { CardActionButton } from "@repo/ui/components/ui/card-action-button";
import { Tag } from "@repo/ui/components/ui/tag";
import { NavCard } from "@repo/ui/components/ui/nav-card";
import {
  ArrowLeftRight,
  PackageSearch,
  ScanBarcode,
  SlidersHorizontal,
} from "@repo/ui/icons";

export default function InventoryDashboardPage() {
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const { data, isLoading, error } = useInventoryDashboard({ warehouseId });
  const { alerts, isLoading: alertsLoading } = useStockAlerts({
    status: "OPEN",
    limit: 8,
    warehouseId,
  });
  const { warehouses, isLoading: warehousesLoading } = useWarehouses({
    limit: 1,
  });
  const { evaluateAlerts } = useInventoryMutations();

  const dashboard = data?.data;
  const needsSetup = !warehousesLoading && warehouses.length === 0;

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Inventory"
          subtitle="How much stock you have right now, where it is, and what it is worth."
          actions={
            <>
              <WarehouseFilter
                value={warehouseId}
                onChange={setWarehouseId}
                className="w-full sm:w-56"
              />
              <Button
                type="button"
                onClick={() => evaluateAlerts.mutate({ warehouseId })}
                disabled={evaluateAlerts.isPending}
                variant="outline"
                className="px-3 whitespace-nowrap"
              >
                {evaluateAlerts.isPending ? "Checking…" : "Run reorder check"}
              </Button>
            </>
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={evaluateAlerts.error} />

        {evaluateAlerts.isSuccess && evaluateAlerts.data && (
          <Alert tone="info" title="Reorder evaluation complete">
            Evaluated {evaluateAlerts.data.data.evaluatedRules} reorder rule(s):{" "}
            {evaluateAlerts.data.data.raised} alert(s) raised,{" "}
            {evaluateAlerts.data.data.resolved} resolved,{" "}
            {evaluateAlerts.data.data.requisitionsCreated} purchase
            requisition(s) created automatically.
          </Alert>
        )}

        {needsSetup ? (
          <EmptyState
            title="No warehouse configured yet"
            description="Inventory needs at least one warehouse with a storage zone and bins before stock can be received. Nothing here is pre-filled with sample data — set up your real locations to begin."
            action={
              <Button asChild>
                <Link href="/warehouse">Set up warehouses</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid-auto-fit gap-3">
              <StatCard
                label="Stock value"
                value={
                  isLoading ? "—" : formatMoney(dashboard?.totalStockValue)
                }
                hint={`${dashboard?.distinctItems ?? 0} distinct item(s)`}
                href="/inventory/valuation"
              />
              <StatCard
                label="Available quantity"
                value={
                  isLoading ? "—" : formatQuantity(dashboard?.availableQuantity)
                }
                hint={`${formatQuantity(dashboard?.reservedQuantity)} reserved`}
                href="/inventory/stock"
              />
              <StatCard
                label="Open alerts"
                value={isLoading ? "—" : (dashboard?.openAlerts ?? 0)}
                hint={
                  dashboard?.alertsBySeverity?.CRITICAL
                    ? `${dashboard.alertsBySeverity.CRITICAL} critical`
                    : "No critical alerts"
                }
                tone={
                  dashboard?.alertsBySeverity?.CRITICAL
                    ? "critical"
                    : dashboard?.openAlerts
                      ? "warning"
                      : "positive"
                }
                href="/inventory/alerts"
              />
              <StatCard
                label="Lots expiring in 30 days"
                value={isLoading ? "—" : (dashboard?.lotsExpiringSoon ?? 0)}
                hint="Stock closest to its expiry date is used first"
                tone={dashboard?.lotsExpiringSoon ? "warning" : "neutral"}
                href="/inventory/stock"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Panel
                flush
                title="Movement summary"
                description={
                  dashboard
                    ? `Stock coming in and going out over the period you picked. ${dashboard.movementCount ?? 0} entries.`
                    : "Stock coming in and going out over the period you picked."
                }
                className="lg:col-span-2"
              >
                <PanelInset className="pb-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <StatCard
                      label="Value received"
                      value={formatMoney(dashboard?.inboundValue)}
                      tone="positive"
                    />
                    <StatCard
                      label="Value issued"
                      value={formatMoney(dashboard?.outboundValue)}
                      tone="info"
                    />
                  </div>
                </PanelInset>
                <SimpleTable
                  isLoading={isLoading}
                  rows={dashboard?.movementsByType ?? []}
                  keyOf={row => row.movementType}
                  empty="No stock has moved in this period yet."
                  columns={[
                    {
                      header: "Movement type",
                      cell: row =>
                        row.movementType ? <Tag>{row.movementType}</Tag> : "—",
                    },
                    {
                      header: "Entries",
                      align: "right",
                      cell: row => row.count,
                    },
                    {
                      header: "Quantity",
                      align: "right",
                      cell: row => formatQuantity(row.quantity),
                    },
                  ]}
                />
              </Panel>

              <Panel
                title="Alerts needing attention"
                footerAction={
                  <CardActionButton href="/inventory/alerts">
                    View all
                  </CardActionButton>
                }
              >
                {alertsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-12 animate-pulse rounded bg-muted"
                      />
                    ))}
                  </div>
                ) : alerts.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Nothing is below its threshold right now.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {alerts.map(alert => (
                      <li
                        key={alert.id}
                        className="border-b pb-3 last:border-0 last:pb-0"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {alert.product.code}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {alert.message}
                            </p>
                          </div>
                          <SeverityBadge severity={alert.severity} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <div className="grid-auto-fit gap-3">
              {[
                {
                  href: "/inventory/stock",
                  label: "Stock positions",
                  hint: "On hand, reserved and available",
                  icon: PackageSearch,
                },
                {
                  href: "/inventory/movements",
                  label: "Stock ledger",
                  hint: "Every posted movement",
                  icon: ArrowLeftRight,
                },
                {
                  href: "/inventory/reorder-rules",
                  label: "Reorder policies",
                  hint: "Safety stock and reorder points",
                  icon: SlidersHorizontal,
                },
                {
                  href: "/inventory/counts",
                  label: "Stock counts",
                  hint: "Cycle counting and variance posting",
                  icon: ScanBarcode,
                },
              ].map(link => (
                <NavCard key={link.href} {...link} />
              ))}
            </div>
          </>
        )}
      </PageShell>
    </ProtectedRoute>
  );
}
