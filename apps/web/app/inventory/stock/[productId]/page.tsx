"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  DetailRow,
  ErrorBanner,
  PageHeader,
  Panel,
  SimpleTable,
  StatCard,
  StatusBadge,
  TabBar,
} from "@/components/supply-chain/shared";
import {
  useProductStock,
  useStockMovements,
  useWhereUsed,
} from "@/hooks/useSupplyChain";
import {
  daysUntil,
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
  humanizeEnum,
} from "@/lib/utils/decimal";

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
      <div className="space-y-5 p-4">
        <PageHeader
          title={
            detail
              ? `${detail.product.code} — ${detail.product.name}`
              : "Stock detail"
          }
          subtitle={
            detail
              ? `${humanizeEnum(detail.product.itemType ?? "")} · ${humanizeEnum(detail.product.trackingType ?? "NONE")} tracking · ${detail.product.pickingStrategy} picking · ${humanizeEnum(detail.product.valuationMethod)} valuation`
              : undefined
          }
          breadcrumb={[
            { label: "Inventory", href: "/inventory" },
            { label: "Stock", href: "/inventory/stock" },
            { label: detail?.product.code ?? String(productId) },
          ]}
        />

        <ErrorBanner error={error} />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <Panel title="By warehouse">
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

        <TabBar
          label="Stock detail sections"
          value={tab}
          onChange={setTab}
          items={[
            [
              "locations",
              `Locations & lots (${detail?.locations.length ?? 0})`,
            ],
            ["movements", "Ledger"],
            [
              "reservations",
              `Reservations (${detail?.reservations.length ?? 0})`,
            ],
            ["whereUsed", "Where used"],
          ]}
        />

        {tab === "locations" && (
          <Panel
            title="Where this stock physically is"
            description="Each row is one bin/lot slot. FEFO picks the earliest expiry first; FIFO the earliest receipt."
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
                            ? "font-medium text-red-700"
                            : soon
                              ? "font-medium text-amber-700"
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
            title="Stock ledger"
            description="Every posted movement for this item, newest first"
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
                { header: "Type", cell: row => humanizeEnum(row.movementType) },
                {
                  header: "Direction",
                  cell: row => (
                    <span
                      className={
                        row.direction === "IN"
                          ? "text-emerald-700"
                          : row.direction === "OUT"
                            ? "text-red-700"
                            : "text-blue-700"
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
            title="Active reservations"
            description="Stock promised to a demand document and not free to sell"
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
                  cell: row => humanizeEnum(row.referenceType),
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
              title="Used as a component"
              description="Bills of materials that consume this item"
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
              title="Approved as a substitute"
              description="Where this item can stand in for another component"
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>
    </ProtectedRoute>
  );
}
