"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import {
  CategoryBarChart,
  CompositionBar,
  RatioGauge,
} from "@repo/ui/components/ui/chart-primitives";
import {
  ArrowUpRight,
  Boxes,
  Component,
  GitBranch,
  Handshake,
  PackageCheck,
  RefreshCw,
  TriangleAlert,
  Warehouse,
  Wallet,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "../lib/toast";
import {
  useBoms,
  useInventoryDashboard,
  useMaterialShortages,
  usePurchasingDashboard,
  useWmsDashboard,
} from "../hooks/useSupplyChain";
import {
  formatMoney,
  formatQuantity,
  humanizeEnum,
  toNumber,
} from "../lib/utils/decimal";
import { ErrorBanner, StatusBadge } from "./supply-chain/shared";

const metricIconClass = "size-[18px]";

function OverviewMetric({
  label,
  value,
  hint,
  icon: Icon,
  href,
  attention = false,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: typeof Wallet;
  href: string;
  attention?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-sm shadow-foreground/[0.025] outline-none transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/30 ${
        attention
          ? "border-error/25 hover:border-error/40"
          : "border-border hover:border-primary/25"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
            attention
              ? "bg-error-surface text-error-foreground"
              : "bg-secondary text-muted-foreground group-hover:bg-accent group-hover:text-primary"
          }`}
        >
          <Icon className={metricIconClass} />
        </span>
      </div>
      <p
        className="mt-3 truncate text-2xl font-semibold leading-none tracking-tight text-foreground"
        title={String(value)}
      >
        {value}
      </p>
      <p
        className={`mt-1.5 text-xs font-medium leading-4 ${
          attention ? "text-error-foreground" : "text-muted-foreground"
        }`}
      >
        {hint}
      </p>
    </Link>
  );
}

function ModuleCard({
  title,
  detail,
  href,
  icon: Icon,
  loading = false,
}: {
  title: string;
  detail: string;
  href: string;
  icon: typeof Boxes;
  loading?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm shadow-foreground/[0.02] outline-none transition-[background-color,border-color,box-shadow] duration-150 hover:border-primary/25 hover:bg-surface-subtle hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          {title}
        </span>
        {loading ? (
          <span className="mt-1.5 block h-3 w-4/5 animate-pulse rounded bg-muted" />
        ) : (
          <span className="mt-1 block line-clamp-2 text-xs leading-4 text-muted-foreground">
            {detail}
          </span>
        )}
      </span>
      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-[color,transform] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

function PanelRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-11 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

function DashboardPanel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm shadow-foreground/[0.025] ${className}`}
    >
      <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action ? (
          <div className="shrink-0 whitespace-nowrap pt-0.5">{action}</div>
        ) : null}
      </header>
      {/* Panels hold charts and lists that need their own room, so only the
          chrome tightens here — the body keeps a full 1rem of breathing space. */}
      <div className="flex min-w-0 flex-1 flex-col p-4">{children}</div>
    </section>
  );
}

function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      {children}
      <ArrowUpRight className="size-3.5" />
    </Link>
  );
}

export function AnalyticsDashboard() {
  const { user } = useAuth();
  const inventoryQuery = useInventoryDashboard();
  const wmsQuery = useWmsDashboard();
  const purchasingQuery = usePurchasingDashboard();
  const shortagesQuery = useMaterialShortages();
  const bomsQuery = useBoms({ page: 1, limit: 5 });

  const inventory = inventoryQuery.data?.data;
  const wms = wmsQuery.data?.data;
  const purchasing = purchasingQuery.data?.data;
  const shortages = shortagesQuery.data?.data;
  const boms = bomsQuery.boms;
  const isLoading = [
    inventoryQuery,
    wmsQuery,
    purchasingQuery,
    shortagesQuery,
    bomsQuery,
  ].some(query => query.isLoading);
  const isRefreshing = [
    inventoryQuery,
    wmsQuery,
    purchasingQuery,
    shortagesQuery,
    bomsQuery,
  ].some(query => query.isFetching);
  const error =
    inventoryQuery.error ??
    wmsQuery.error ??
    purchasingQuery.error ??
    shortagesQuery.error ??
    bomsQuery.error;
  const latestUpdate = Math.max(
    inventoryQuery.dataUpdatedAt,
    wmsQuery.dataUpdatedAt,
    purchasingQuery.dataUpdatedAt,
    shortagesQuery.dataUpdatedAt,
    bomsQuery.dataUpdatedAt
  );

  const refreshAll = async () => {
    const results = await Promise.all([
      inventoryQuery.refetch(),
      wmsQuery.refetch(),
      purchasingQuery.refetch(),
      shortagesQuery.refetch(),
      bomsQuery.refetch(),
    ]);
    const failed = results.find(result => result.isError);
    if (failed) {
      toast.error(failed.error, "Dashboard refresh failed");
      return;
    }
    toast.success("Dashboard data refreshed");
  };

  const movementRows = inventory?.movementsByType ?? [];
  // Largest movement first, so the chart reads top-down by magnitude.
  const movementChartData = movementRows
    .map(row => ({
      name: humanizeEnum(row.movementType),
      value: toNumber(row.quantity),
      display: formatQuantity(row.quantity),
      detail: [{ label: "Ledger entries", value: String(row.count) }],
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const orderStatusRows = purchasing?.ordersByStatus ?? [];
  const committedOrderValue = orderStatusRows.reduce(
    (total, row) => total + toNumber(row.value),
    0
  );
  const orderStatusSegments = orderStatusRows.slice(0, 5).map(row => ({
    key: row.status,
    label: humanizeEnum(row.status),
    value: toNumber(row.value),
    display: formatMoney(row.value),
    meta: `${row.count} order${row.count === 1 ? "" : "s"}`,
  }));
  const firstName = user?.firstName?.trim();
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="dashboard-page space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </p>
          <h1 className="mt-0.5 text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-2xl">
            Operations overview
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <div
            className="flex items-center gap-2 text-xs text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <span className="relative flex size-2">
              {!error && !isRefreshing && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-50" />
              )}
              <span
                className={`relative inline-flex size-2 rounded-full ${
                  error
                    ? "bg-error"
                    : isRefreshing
                      ? "animate-pulse bg-info"
                      : "bg-success"
                }`}
              />
            </span>
            {error
              ? "Live sync interrupted"
              : isRefreshing && !isLoading
                ? "Refreshing live data"
                : latestUpdate
                  ? `Synced ${new Date(latestUpdate).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "Connecting to live data"}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refreshAll()}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            {isRefreshing && !isLoading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </header>

      <ErrorBanner error={error} />

      <section
        aria-label="Operational summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <OverviewMetric
          label="Inventory value"
          value={isLoading ? "—" : formatMoney(inventory?.totalStockValue)}
          hint={
            isLoading
              ? "Loading…"
              : `${inventory?.distinctItems ?? 0} stocked items`
          }
          icon={Wallet}
          href="/inventory/valuation"
        />
        <OverviewMetric
          label="Available quantity"
          value={isLoading ? "—" : formatQuantity(inventory?.availableQuantity)}
          hint={
            isLoading
              ? "Loading…"
              : `${formatQuantity(inventory?.reservedQuantity)} reserved`
          }
          icon={PackageCheck}
          href="/inventory/stock"
        />
        <OverviewMetric
          label="Open stock alerts"
          value={isLoading ? "—" : (inventory?.openAlerts ?? 0)}
          hint={
            isLoading
              ? "Loading…"
              : `${inventory?.alertsBySeverity?.CRITICAL ?? 0} critical`
          }
          icon={TriangleAlert}
          href="/inventory/alerts"
          attention={!isLoading && !!inventory?.openAlerts}
        />
        <OverviewMetric
          label="Open PO commitment"
          value={isLoading ? "—" : formatMoney(purchasing?.openCommitmentValue)}
          hint={
            isLoading
              ? "Loading…"
              : `${purchasing?.overdueOrders ?? 0} overdue orders`
          }
          icon={Handshake}
          href="/purchasing/orders"
          attention={!isLoading && !!purchasing?.overdueOrders}
        />
      </section>

      <section className="space-y-3" aria-labelledby="workspace-heading">
        <div>
          <h2
            id="workspace-heading"
            className="text-sm font-semibold text-foreground"
          >
            Workspaces
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Jump into a module and continue operational work.
          </p>
        </div>
        <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <ModuleCard
            loading={isLoading}
            title="Inventory"
            detail={`${inventory?.distinctItems ?? 0} items across ${inventory?.activeWarehouses ?? 0} active warehouses`}
            href="/inventory"
            icon={Boxes}
          />
          <ModuleCard
            loading={isLoading}
            title="Materials"
            detail={`${shortages?.totalShortages ?? 0} shortages, ${shortages?.criticalShortages ?? 0} critical`}
            href="/materials"
            icon={Component}
          />
          <ModuleCard
            loading={isLoading}
            title="Warehouse"
            detail={`${wms?.binOccupancyPercent ?? 0}% bin occupancy, ${wms?.openPickLists ?? 0} open pick lists`}
            href="/warehouse"
            icon={Warehouse}
          />
          <ModuleCard
            loading={isLoading}
            title="BOM & production"
            detail={`${bomsQuery.pagination?.totalItems ?? 0} controlled BOM records`}
            href="/bom"
            icon={GitBranch}
          />
          <ModuleCard
            loading={isLoading}
            title="Purchasing"
            detail={`${purchasing?.activeSuppliers ?? 0} active suppliers, ${purchasing?.openRequisitions ?? 0} open requests`}
            href="/purchasing"
            icon={Handshake}
          />
        </div>
      </section>

      <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]">
        <DashboardPanel
          title="Stock movement"
          description={
            isLoading
              ? "Loading posted ledger entries…"
              : `${inventory?.movementCount ?? 0} posted ledger entries in the current reporting period`
          }
          action={
            <PanelLink href="/inventory/movements">View ledger</PanelLink>
          }
        >
          {isLoading ? (
            <PanelRowsSkeleton />
          ) : movementRows.length === 0 ? (
            <p className="m-auto py-10 text-center text-sm text-muted-foreground">
              No posted stock movement exists for this period.
            </p>
          ) : (
            <div className="flex h-full flex-col">
              <CategoryBarChart
                data={movementChartData}
                valueLabel="Quantity"
                height={Math.max(148, movementChartData.length * 34)}
              />
              <div className="mt-auto grid gap-2.5 border-t pt-3.5 sm:grid-cols-2">
                <div className="rounded-lg bg-surface-subtle px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    Value received
                  </p>
                  <p className="mt-1 text-lg font-semibold leading-none tabular-nums">
                    {formatMoney(inventory?.inboundValue)}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-subtle px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Value issued</p>
                  <p className="mt-1 text-lg font-semibold leading-none tabular-nums">
                    {formatMoney(inventory?.outboundValue)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Warehouse flow"
          description="Open execution work and storage capacity"
          action={<PanelLink href="/warehouse">Open WMS</PanelLink>}
        >
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
            {[
              ["Putaway tasks", wms?.openPutawayTasks ?? 0],
              ["Open pick lists", wms?.openPickLists ?? 0],
              ["Pending picks", wms?.pendingPickTasks ?? 0],
              ["Awaiting dispatch", wms?.packagesAwaitingDispatch ?? 0],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-lg border border-border bg-surface-subtle px-3 py-2.5"
              >
                <p className="text-xs leading-4 text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 text-xl font-semibold leading-none tabular-nums">
                  {isLoading ? "—" : value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-col items-center rounded-xl border border-border px-4 py-3.5">
            <p className="self-start text-sm font-medium">Bin occupancy</p>
            <RatioGauge
              className="mt-1"
              size={132}
              value={isLoading ? 0 : (wms?.binOccupancyPercent ?? 0)}
              // Storage that is nearly full is the condition worth reacting to,
              // so the arc changes colour rather than staying decorative.
              emphasis={
                !isLoading && (wms?.binOccupancyPercent ?? 0) >= 85
                  ? "warning"
                  : "neutral"
              }
              caption={
                isLoading
                  ? "Loading bin utilisation…"
                  : `${wms?.occupiedBins ?? 0} occupied of ${wms?.totalBins ?? 0} bins`
              }
            />
          </div>
        </DashboardPanel>
      </div>

      <div className="grid items-stretch gap-3 xl:grid-cols-3">
        <DashboardPanel
          title="Material readiness"
          description="Items below configured thresholds"
          action={
            <PanelLink href="/materials/shortages">All shortages</PanelLink>
          }
        >
          {isLoading ? (
            <PanelRowsSkeleton />
          ) : shortages?.rows?.length ? (
            <div className="divide-y">
              {shortages.rows.slice(0, 5).map(row => (
                <Link
                  key={`${row.product.id}-${row.warehouse.id}`}
                  href={`/inventory/stock/${row.product.id}?warehouseId=${row.warehouse.id}`}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {row.product.code} · {row.product.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.warehouse.code}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-error-foreground">
                      -{formatQuantity(row.shortfallQuantity)}
                    </p>
                    <p className="text-xs text-muted-foreground">short</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="m-auto py-8 text-center text-sm text-muted-foreground">
              No material is below its configured threshold.
            </p>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="BOM control"
          description="Latest controlled product structures"
          action={<PanelLink href="/bom">All BOMs</PanelLink>}
        >
          {isLoading ? (
            <PanelRowsSkeleton />
          ) : boms.length ? (
            <div className="divide-y">
              {boms.map(bom => (
                <Link
                  key={bom.id}
                  href={`/bom/${bom.id}`}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {bom.bomNumber} · {bom.product.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      v{bom.version}
                      {bom.revision} · {bom._count?.components ?? 0} components
                    </p>
                  </div>
                  <StatusBadge status={bom.status} />
                </Link>
              ))}
            </div>
          ) : (
            <p className="m-auto py-8 text-center text-sm text-muted-foreground">
              No BOM has been created yet.
            </p>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Purchase orders"
          description="Committed value grouped by order status"
          action={<PanelLink href="/purchasing/orders">All orders</PanelLink>}
        >
          {isLoading ? (
            <PanelRowsSkeleton />
          ) : (purchasing?.ordersByStatus ?? []).length ? (
            <div className="flex h-full flex-col">
              <CompositionBar
                segments={orderStatusSegments}
                total={formatMoney(committedOrderValue)}
              />
              <div className="mt-auto grid grid-cols-2 gap-3 border-t pt-3.5">
                <div>
                  <p className="text-xs text-muted-foreground">30-day spend</p>
                  <p className="mt-1 font-semibold tabular-nums">
                    {formatMoney(purchasing?.spendLast30Days)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pending QC</p>
                  <p className="mt-1 font-semibold tabular-nums">
                    {purchasing?.receiptsPendingQc ?? 0}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="m-auto py-8 text-center text-sm text-muted-foreground">
              No purchase orders have been raised yet.
            </p>
          )}
        </DashboardPanel>
      </div>
    </div>
  );
}

export function AnalyticsDashboardSkeleton() {
  return (
    <div className="dashboard-page space-y-4">
      <div className="h-14 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-[4.25rem] animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="h-80 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-72 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
