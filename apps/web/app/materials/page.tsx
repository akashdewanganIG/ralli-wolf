"use client";

import { useState } from "react";
import { Input } from "@repo/ui/components/ui/input";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import {
  ErrorBanner,
  PageHeader,
  Pager,
  Panel,
  SelectField,
  SimpleTable,
  StatCard,
  DEFAULT_PAGE_SIZE,
} from "@/components/supply-chain/shared";
import { WarehouseFilter } from "@/components/supply-chain/warehouse-filter";
import { useMaterialShortages, useMaterials } from "@/hooks/use-supply-chain";
import { formatMoney, formatQuantity, humanizeEnum } from "@/lib/utils/decimal";
import type { ItemType } from "@/lib/api/types/supply-chain";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { DashboardToolbar } from "@repo/ui/components/ui/dashboard-toolbar";
import { SearchInput } from "@repo/ui/components/ui/search-input";
import { Tag } from "@repo/ui/components/ui/tag";
import { ItemThumbnail } from "@/components/supply-chain/item-thumbnail";

const MATERIAL_TYPES: ItemType[] = [
  "RAW_MATERIAL",
  "COMPONENT",
  "CONSUMABLE",
  "PACKAGING",
];

export default function MaterialsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [itemType, setItemType] = useState("");

  const { materials, pagination, isLoading, error } = useMaterials({
    page,
    limit: DEFAULT_PAGE_SIZE,
    search: search || undefined,
    warehouseId,
    itemType: itemType || undefined,
  });
  const { data: shortageData } = useMaterialShortages({ warehouseId });

  const shortages = shortageData?.data;

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Material management"
          subtitle="The raw materials you buy and use, and whether you still have enough."
          actions={
            <>
              <WarehouseFilter
                value={warehouseId}
                onChange={value => {
                  setWarehouseId(value);
                  setPage(1);
                }}
                className="w-full sm:w-56"
              />
              <Link
                href="/materials/availability"
                className="rounded-lg border inline-flex items-center justify-center h-10 whitespace-nowrap px-3 text-sm font-medium hover:bg-muted"
              >
                Check build availability
              </Link>
            </>
          }
        />

        <ErrorBanner error={error} />

        <div className="grid-auto-fit gap-3">
          <StatCard
            label="Materials tracked"
            value={pagination?.totalItems ?? 0}
            href="/materials"
          />
          <StatCard
            label="Below safety stock"
            value={shortages?.totalShortages ?? 0}
            tone={shortages?.totalShortages ? "warning" : "positive"}
            href="/materials/shortages"
          />
          <StatCard
            label="Fully stocked out"
            value={shortages?.criticalShortages ?? 0}
            tone={shortages?.criticalShortages ? "critical" : "positive"}
            href="/materials/shortages"
          />
          <StatCard
            label="Consumption & wastage"
            value="Report"
            hint="Issued vs scrapped by period"
            href="/materials/consumption"
          />
        </div>

        <Panel
          title="Materials"
          flush
          actions={
            <DashboardToolbar
              search={
                <SearchInput
                  placeholder="Search material code or name"
                  value={search}
                  onChange={event => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              }
              actions={
                <SelectField
                  aria-label="Filter by material type"
                  className="w-full sm:w-48"
                  value={itemType}
                  onChange={event => {
                    setItemType(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All material types</option>
                  {MATERIAL_TYPES.map(type => (
                    <option key={type} value={type}>
                      {humanizeEnum(type)}
                    </option>
                  ))}
                </SelectField>
              }
            />
          }
        >
          <SimpleTable
            isLoading={isLoading}
            rows={materials}
            keyOf={row => row.id}
            rowClassName={row =>
              row.isBelowSafetyStock ? "bg-warning-surface/40" : ""
            }
            empty="No materials yet. Set a product's item type to Raw Material, Component, Consumable or Packaging for it to appear here."
            columns={[
              {
                header: "Material",
                cell: row => (
                  <Link
                    href={`/inventory/stock/${row.id}`}
                    className="flex items-center gap-2.5 text-primary hover:text-info"
                  >
                    <ItemThumbnail url={row.imageUrl} alt={row.name} />
                    <span>
                      <span className="font-mono text-xs">{row.code}</span>
                      <span className="ml-2 text-sm">{row.name}</span>
                    </span>
                  </Link>
                ),
              },
              {
                header: "Type",
                cell: row => (row.itemType ? <Tag>{row.itemType}</Tag> : "—"),
              },
              { header: "UoM", cell: row => row.uom?.code ?? "—" },
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
                cell: row => (
                  <span
                    className={
                      row.isBelowSafetyStock
                        ? "font-semibold text-warning-foreground"
                        : ""
                    }
                  >
                    {formatQuantity(row.availableQuantity)}
                  </span>
                ),
              },
              {
                header: "On order",
                align: "right",
                cell: row => formatQuantity(row.incomingQuantity),
              },
              {
                header: "Safety stock",
                align: "right",
                cell: row =>
                  row.safetyStock === null ? (
                    <span className="text-muted-foreground">not set</span>
                  ) : (
                    formatQuantity(row.safetyStock)
                  ),
              },
              {
                header: "Value",
                align: "right",
                cell: row => formatMoney(row.stockValue),
              },
              {
                header: "Purchasable",
                cell: row =>
                  row.isPurchasable ? (
                    <span className="text-xs font-medium text-success-foreground">
                      Yes
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No</span>
                  ),
              },
            ]}
          />
          <Pager
            page={page}
            totalPages={pagination?.totalPages}
            onChange={setPage}
          />
        </Panel>
      </PageShell>
    </ProtectedRoute>
  );
}
