"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import {
  CategoryBarChart,
  MagnitudeBars,
  RatioGauge,
} from "@repo/ui/components/ui/chart-primitives";
import {
  Boxes,
  Component,
  GitBranch,
  Handshake,
  PackageCheck,
  RefreshCw,
  TriangleAlert,
  Warehouse,
  Wallet,
} from "@repo/ui/icons";
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
import {
  MetricCard,
  type MetricTone,
} from "@repo/ui/components/ui/metric-card";
import { CardActionButton } from "@repo/ui/components/ui/card-action-button";
import { Panel } from "@repo/ui/components/ui/panel";
import { PageShell } from "@repo/ui/components/ui/page-shell";

/**
 * Dashboard KPI.
 *
 * Delegates to the shared `MetricCard` so the top row of this page and the stat
 * rows on every module screen are literally the same component — they had
 * drifted to different paddings, icon sizes, and hint colours.
 */
function OverviewMetric({
  label,
  value,
  hint,
  description,
  icon: Icon,
  href,
  attention = false,
}: {
  label: string;
  value: string | number;
  hint: string;
  description?: string;
  icon: typeof Wallet;
  href: string;
  attention?: boolean;
}) {
  const tone: MetricTone = attention ? "critical" : "neutral";
  return (
    <MetricCard
      label={label}
      value={value}
      hint={hint}
      description={description}
      tone={tone}
      icon={Icon}
      href={href}
    />
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
    // No trailing arrow. The whole tile is the link — the border, surface, and
    // shadow all respond on hover and it carries a focus ring — so a chevron
    // only restated what the cursor and the treatment already say.
    <Link
      href={href}
      className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm shadow-foreground/[0.02] outline-none transition-[background-color,border-color,box-shadow] duration-150 hover:border-border-strong hover:bg-surface-subtle hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          {title}
        </span>
        {loading ? (
          <span className="mt-1.5 block h-3 w-4/5 animate-pulse rounded bg-muted" />
        ) : (
          <span className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">
            {detail}
          </span>
        )}
      </span>
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

/**
 * The small label-over-number card used inside a panel.
 *
 * Warehouse flow set this pattern and it reads best of the lot, so every panel
 * that shows supporting figures uses exactly this rather than a hand-rolled
 * div: one muted label, one large tabular number, on the subtle surface so the
 * card separates from the panel without competing with it.
 */
function MetricTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-subtle px-3 py-2.5">
      <p className="text-xs leading-4 text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold leading-none tabular-nums">
        {value}
      </p>
    </div>
  );
}

/**
 * The bordered box the tiles sit in.
 *
 * A rule between the chart above and the figures below separated them but left
 * the figures floating; a container groups them instead, and matches the box
 * the bin-occupancy gauge already sits in.
 */
function MetricTiles({
  children,
  columns = 2,
  className = "",
}: {
  children: ReactNode;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border p-2.5 ${className}`}>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The panel's own action, at its foot.
 *
 * It used to sit in the header beside the title, where it competed with the
 * heading for first read and left the bottom edge of every panel ragged.
 */
function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return <CardActionButton href={href}>{children}</CardActionButton>;
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
  const orderStatusBars = orderStatusRows.slice(0, 5).map(row => {
    const value = toNumber(row.value);
    const share =
      committedOrderValue > 0
        ? Math.round((value / committedOrderValue) * 100)
        : 0;
    return {
      key: row.status,
      label: humanizeEnum(row.status),
      value,
      display: formatMoney(row.value),
      // Bars scale to the largest status, so the share of the whole has to be
      // stated rather than inferred from a length.
      meta: `${share}% · ${row.count} order${row.count === 1 ? "" : "s"}`,
    };
  });
  const firstName = user?.firstName?.trim();
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <PageShell gap="tight">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </p>
          <h1 className="mt-0.5 text-base font-semibold leading-6 tracking-tight text-foreground sm:text-lg sm:leading-7">
            Operations overview
          </h1>
        </div>

        {/* Sync state is not shown here any more — it lives in the system-status
            menu in the header, so there is one place to look rather than a dot
            above the metrics and a badge beside the page title. */}
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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

      <section aria-label="Operational summary" className="grid-auto-fit gap-3">
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
        <div className="grid-auto-fit items-stretch gap-3">
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

      <Panel
        title="Stock movement"
        description={
          isLoading
            ? "Stock coming in and going out. Loading…"
            : `Stock coming in and going out over this reporting period. ${inventory?.movementCount ?? 0} entries.`
        }
        action={<PanelLink href="/inventory/movements">View ledger</PanelLink>}
      >
        {isLoading ? (
          <PanelRowsSkeleton />
        ) : movementRows.length === 0 ? (
          <p className="m-auto py-10 text-center text-sm text-muted-foreground">
            No posted stock movement exists for this period.
          </p>
        ) : (
          <div className="flex flex-col">
            {/* This panel no longer shares a row with a sibling that sets the
                height, so the chart is given an explicit one. In fill mode it
                would resolve `height:100%` against an auto-height parent and
                collapse to nothing. Columns are a fixed height regardless of
                how many categories there are — they grow sideways, not down. */}
            <div className="pb-3">
              <CategoryBarChart
                data={movementChartData}
                valueLabel="Quantity"
                height={300}
              />
            </div>
            <MetricTiles>
              <MetricTile
                label="Value received"
                value={formatMoney(inventory?.inboundValue)}
              />
              <MetricTile
                label="Value issued"
                value={formatMoney(inventory?.outboundValue)}
              />
            </MetricTiles>
          </div>
        )}
      </Panel>

      {/* Warehouse flow used to be the narrow column beside stock movement and
          the other three sat three-up. Two-up puts all four on the same width,
          which is what these panels need — each carries a small grid or list of
          its own that a third of the page was squeezing. */}
      <div className="grid items-stretch gap-3 xl:grid-cols-2">
        <Panel
          title="Warehouse flow"
          description="Work still to be done in the warehouse, and how much space is left."
          action={<PanelLink href="/warehouse">Open WMS</PanelLink>}
        >
          <MetricTiles>
            {[
              ["Putaway tasks", wms?.openPutawayTasks ?? 0],
              ["Open pick lists", wms?.openPickLists ?? 0],
              ["Pending picks", wms?.pendingPickTasks ?? 0],
              ["Awaiting dispatch", wms?.packagesAwaitingDispatch ?? 0],
            ].map(([label, value]) => (
              <MetricTile
                key={String(label)}
                label={String(label)}
                value={isLoading ? "—" : value}
              />
            ))}
          </MetricTiles>
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
        </Panel>

        <Panel
          title="Material readiness"
          description="Items that have dropped below the minimum level you set."
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
        </Panel>

        <Panel
          title="BOM control"
          description="The most recent approved parts lists for your products."
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
        </Panel>

        <Panel
          title="Purchase orders"
          description="How much money is tied up in purchase orders, split by how far each has got."
          action={<PanelLink href="/purchasing/orders">All orders</PanelLink>}
        >
          {isLoading ? (
            <PanelRowsSkeleton />
          ) : (purchasing?.ordersByStatus ?? []).length ? (
            <div className="flex h-full flex-col">
              {/* The denominator the bars are read against, stated once. */}
              <div className="flex items-baseline justify-between gap-3 pb-3">
                <span className="text-xs text-muted-foreground">
                  Committed value
                </span>
                <span className="text-lg font-semibold leading-none tabular-nums">
                  {formatMoney(committedOrderValue)}
                </span>
              </div>
              {/* The list absorbs the spare height so the tiles stay pinned to
                  the foot of the panel, level with the sibling beside it. */}
              <MagnitudeBars data={orderStatusBars} className="flex-1" />
              <MetricTiles className="mt-3">
                <MetricTile
                  label="30-day spend"
                  value={formatMoney(purchasing?.spendLast30Days)}
                />
                <MetricTile
                  label="Pending QC"
                  value={purchasing?.receiptsPendingQc ?? 0}
                />
              </MetricTiles>
            </div>
          ) : (
            <p className="m-auto py-8 text-center text-sm text-muted-foreground">
              No purchase orders have been raised yet.
            </p>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}

export function AnalyticsDashboardSkeleton() {
  return (
    <PageShell gap="tight">
      <div className="h-14 animate-pulse rounded-xl bg-muted" />
      <div className="grid-auto-fit gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="grid-auto-fit gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-[4.25rem] animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      </div>
      {/* Mirrors the real layout: one full-width panel, then four two-up. */}
      <div className="h-80 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-3 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-72 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </PageShell>
  );
}
