"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import {
  DetailRow,
  ErrorBanner,
  PageHeader,
  Panel,
  SimpleTable,
  StatCard,
  StatusBadge,
} from "@/components/supply-chain/shared";
import {
  useProductStock,
  useStockMovements,
  useWhereUsed,
} from "@/hooks/use-supply-chain";
import {
  daysUntil,
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
  humanizeEnum,
} from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { Tag } from "@repo/ui/components/ui/tag";
import { CategorySwitcher } from "@repo/ui/components/ui/category-switcher";

export default function ProductStockDetailPage() {
  const params = useParams<{ productId: string }>();
  const searchParams = useSearchParams();
  const productId = Number(params.productId);
  const warehouseId = searchParams.get("warehouseId")
    ? Number(searchParams.get("warehouseId"))
    : undefined;
  const [tab, setTab] = useState<
    "locations" | "movements" | "reservations" | "whereUsed"
  >("locations");

  const { data, isLoading, error } = useProductStock(productId, {
    warehouseId,
  });
  const { movements, isLoading: movementsLoading } = useStockMovements({
    productId,
    warehouseId,
    limit: 50,
  });
  const { data: whereUsedData, isLoading: whereUsedLoading } = useWhereUsed(
    productId,
    tab === "whereUsed"
  );

  const detail = data?.data;
  const totals = detail?.totals ?? [];
  const overall = totals.reduce(
    (acc, entry) => ({
      onHand: acc.onHand + Number(entry.onHandQuantity),
      reserved: acc.reserved + Number(entry.reservedQuantity),
      available: acc.available + Number(entry.availableQuantity),
      value: acc.value + Number(entry.stockValue),
    }),
    { onHand: 0, reserved: 0, available: 0, value: 0 }
  );

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title={
            detail
              ? `${detail.product.code} — ${detail.product.name}`
              : "Stock detail"
          }
          subtitle={
            detail
              ? `Everything about one item: where it is stored, how much is promised, and every time it moved. This one is a ${humanizeEnum(detail.product.itemType ?? "").toLowerCase()}.`
              : undefined
          }
          breadcrumb={[
            { label: "Inventory", href: "/inventory" },
            { label: "Stock", href: "/inventory/stock" },
            { label: detail?.product.code ?? String(productId) },
          ]}
        />

        <ErrorBanner error={error} />

        <div className="grid-auto-fit gap-3">
          <StatCard
            label="On hand"
            value={isLoading ? "—" : formatQuantity(overall.onHand)}
          />
          <StatCard
            label="Reserved"
            value={isLoading ? "—" : formatQuantity(overall.reserved)}
          />
          <StatCard
            label="Available"
            value={isLoading ? "—" : formatQuantity(overall.available)}
            tone={overall.available <= 0 ? "critical" : "positive"}
          />
          <StatCard
            label="Stock value"
            value={isLoading ? "—" : formatMoney(overall.value)}
          />
        </div>

        {totals.length > 1 && (
          <Panel flush title="By warehouse">
            <SimpleTable
              rows={totals}
              keyOf={row => row.warehouse.id}
              columns={[
                {
                  header: "Warehouse",
                  cell: row => `${row.warehouse.code} — ${row.warehouse.name}`,
                },
                {
                  header: "On hand",
                  align: "right",
                  cell: row => formatQuantity(row.onHandQuantity),
                },
                {
                  header: "Reserved",
                  align: "right",
                  cell: row => formatQuantity(row.reservedQuantity),
                },
                {
                  header: "Available",
                  align: "right",
                  cell: row => formatQuantity(row.availableQuantity),
                },
                {
                  header: "Value",
                  align: "right",
                  cell: row => formatMoney(row.stockValue),
                },
              ]}
            />
          </Panel>
        )}

        <CategorySwitcher
          label="Stock detail sections"
          value={tab}
          onValueChange={setTab}
          items={[
            {
              value: "locations",
              label: "Locations & lots",
              count: detail?.locations.length ?? 0,
            },
            { value: "movements", label: "Ledger" },
            {
              value: "reservations",
              label: "Reservations",
              count: detail?.reservations.length ?? 0,
            },
            { value: "whereUsed", label: "Where used" },
          ]}
        />

        {tab === "locations" && (
          <Panel
            flush
            title="Where this stock physically is"
            description="Every place this item is stored right now, and how much sits in each. The oldest stock is used first."
          >
            <SimpleTable
              isLoading={isLoading}
              rows={detail?.locations ?? []}
              keyOf={row => row.id}
              empty="No stock on hand for this item."
              columns={[
                { header: "Warehouse", cell: row => row.warehouse.code },
                {
                  header: "Bin",
                  cell: row => (
                    <div>
                      <span className="font-mono text-xs">{row.bin.code}</span>
                      {row.bin.zone && (
                        <p className="text-xs text-muted-foreground">
                          {row.bin.zone.name}
                        </p>
                      )}
                    </div>
                  ),
                },
                {
                  header: "Lot / batch / serial",
                  cell: row => (
                    <div>
                      <span className="font-mono text-xs">
                        {row.lot.lotNumber}
                      </span>
                      {row.lot.batchNumber && (
                        <p className="text-xs text-muted-foreground">
                          Batch {row.lot.batchNumber}
                        </p>
                      )}
                      {row.lot.serialNumber && (
                        <p className="text-xs text-muted-foreground">
                          S/N {row.lot.serialNumber}
                        </p>
                      )}
                    </div>
                  ),
                },
                {
                  header: "Expiry",
                  cell: row => {
                    if (!row.lot.expiryDate)
                      return <span className="text-muted-foreground">—</span>;
                    const days = daysUntil(row.lot.expiryDate);
                    const expired = days !== null && days < 0;
                    const soon = days !== null && days >= 0 && days <= 30;
                    return (
                      <span
                        className={
                          expired
                            ? "font-medium text-error-foreground"
                            : soon
                              ? "font-medium text-warning-foreground"
                              : ""
                        }
                      >
                        {formatDate(row.lot.expiryDate)}
                        {days !== null && (
                          <span className="ml-1 text-xs">
                            ({expired ? `${Math.abs(days)}d ago` : `${days}d`})
                          </span>
                        )}
                      </span>
                    );
                  },
                },
                { header: "Pallet", cell: row => row.pallet?.code ?? "—" },
                {
                  header: "Quantity",
                  align: "right",
                  cell: row => formatQuantity(row.quantity),
                },
                {
                  header: "Reserved",
                  align: "right",
                  cell: row => formatQuantity(row.reservedQuantity),
                },
                {
                  header: "Unit cost",
                  align: "right",
                  cell: row => formatMoney(row.lot.unitCost),
                },
                {
                  header: "Status",
                  cell: row => <StatusBadge status={row.status} />,
                },
              ]}
            />
          </Panel>
        )}

        {tab === "movements" && (
          <Panel
            flush
            title="Stock ledger"
            description="Every time this item moved in or out, newest first."
          >
            <SimpleTable
              isLoading={movementsLoading}
              rows={movements}
              keyOf={row => row.id}
              empty="No movements recorded for this item."
              columns={[
                { header: "Date", cell: row => formatDateTime(row.occurredAt) },
                {
                  header: "Movement",
                  cell: row => (
                    <span className="font-mono text-xs">
                      {row.movementNumber}
                    </span>
                  ),
                },
                {
                  header: "Type",
                  cell: row =>
                    row.movementType ? <Tag>{row.movementType}</Tag> : "—",
                },
                {
                  header: "Direction",
                  cell: row => (
                    <span
                      className={
                        row.direction === "IN"
                          ? "text-success-foreground"
                          : row.direction === "OUT"
                            ? "text-error-foreground"
                            : "text-info-foreground"
                      }
                    >
                      {row.direction === "IN"
                        ? "↓ In"
                        : row.direction === "OUT"
                          ? "↑ Out"
                          : "↔ Internal"}
                    </span>
                  ),
                },
                { header: "Lot", cell: row => row.lot?.lotNumber ?? "—" },
                {
                  header: "From → To",
                  cell: row =>
                    `${row.fromBin?.code ?? row.fromWarehouse?.code ?? "—"} → ${row.toBin?.code ?? row.toWarehouse?.code ?? "—"}`,
                },
                {
                  header: "Quantity",
                  align: "right",
                  cell: row => formatQuantity(row.quantity),
                },
                {
                  header: "Value",
                  align: "right",
                  cell: row => formatMoney(row.totalCost),
                },
                {
                  header: "Reference",
                  cell: row =>
                    row.referenceNumber ??
                    humanizeEnum(row.referenceType ?? ""),
                },
              ]}
            />
          </Panel>
        )}

        {tab === "reservations" && (
          <Panel
            flush
            title="Active reservations"
            description="Stock already promised to an order, so it cannot be sold to anyone else."
          >
            <SimpleTable
              isLoading={isLoading}
              rows={detail?.reservations ?? []}
              keyOf={row => row.id}
              empty="Nothing is reserved against this item."
              columns={[
                {
                  header: "Reference",
                  cell: row =>
                    row.referenceNumber ??
                    `${humanizeEnum(row.referenceType)} #${row.referenceId}`,
                },
                {
                  header: "Type",
                  cell: row =>
                    row.referenceType ? <Tag>{row.referenceType}</Tag> : "—",
                },
                { header: "Warehouse", cell: row => row.warehouse.code },
                {
                  header: "Quantity",
                  align: "right",
                  cell: row => formatQuantity(row.quantity),
                },
                {
                  header: "Released",
                  align: "right",
                  cell: row => formatQuantity(row.releasedQuantity),
                },
                {
                  header: "Created",
                  cell: row => formatDateTime(row.createdAt),
                },
              ]}
            />
          </Panel>
        )}

        {tab === "whereUsed" && (
          <div className="space-y-4">
            <Panel
              flush
              title="Used as a component"
              description="The products that are built using this item."
            >
              <SimpleTable
                isLoading={whereUsedLoading}
                rows={whereUsedData?.data.usedAsComponent ?? []}
                keyOf={row => `${row.bomId}`}
                empty="This item is not used in any bill of materials."
                columns={[
                  {
                    header: "BOM",
                    cell: row => (
                      <span className="font-mono text-xs">{row.bomNumber}</span>
                    ),
                  },
                  {
                    header: "Builds",
                    cell: row =>
                      `${row.parentProduct.code} — ${row.parentProduct.name}`,
                  },
                  {
                    header: "Version",
                    cell: row => `v${row.version}${row.revision}`,
                  },
                  {
                    header: "Status",
                    cell: row => <StatusBadge status={row.status} />,
                  },
                  {
                    header: "Qty per build",
                    align: "right",
                    cell: row =>
                      `${formatQuantity(row.quantity)} ${row.uomCode ?? ""}`,
                  },
                  {
                    header: "Scrap %",
                    align: "right",
                    cell: row => formatQuantity(row.scrapPercent, 2),
                  },
                ]}
              />
            </Panel>
            <Panel
              flush
              title="Approved as a substitute"
              description="Other parts this item is allowed to replace when they run out."
            >
              <SimpleTable
                isLoading={whereUsedLoading}
                rows={whereUsedData?.data.usedAsSubstitute ?? []}
                keyOf={row => `${row.bomId}-${row.substitutesFor.id}`}
                empty="This item is not registered as a substitute anywhere."
                columns={[
                  {
                    header: "BOM",
                    cell: row => (
                      <span className="font-mono text-xs">{row.bomNumber}</span>
                    ),
                  },
                  { header: "Builds", cell: row => row.parentProduct.code },
                  {
                    header: "Substitutes for",
                    cell: row =>
                      `${row.substitutesFor.code} — ${row.substitutesFor.name}`,
                  },
                  {
                    header: "Priority",
                    align: "right",
                    cell: row => row.priority,
                  },
                  {
                    header: "Conversion",
                    align: "right",
                    cell: row => formatQuantity(row.conversionFactor),
                  },
                ]}
              />
            </Panel>
          </div>
        )}

        {detail && (
          <Panel title="Item settings">
            <div className="grid-auto-fit gap-4">
              <DetailRow
                label="Tracking"
                value={humanizeEnum(detail.product.trackingType ?? "NONE")}
              />
              <DetailRow
                label="Picking strategy"
                value={detail.product.pickingStrategy}
              />
              <DetailRow
                label="Valuation"
                value={humanizeEnum(detail.product.valuationMethod)}
              />
              <DetailRow
                label="Shelf life"
                value={
                  detail.product.shelfLifeDays
                    ? `${detail.product.shelfLifeDays} days`
                    : "Not set"
                }
              />
              <DetailRow
                label="Standard cost"
                value={formatMoney(detail.product.standardCost)}
              />
              <DetailRow
                label="Unit of measure"
                value={detail.product.uom?.code ?? "Not set"}
              />
            </div>
          </Panel>
        )}
      </PageShell>
    </ProtectedRoute>
  );
}
