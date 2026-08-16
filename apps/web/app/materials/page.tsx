"use client";

import { useState } from "react";
import { Input } from "@repo/ui/components/ui/input";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  ErrorBanner,
  PageHeader,
  Pager,
  Panel,
  SelectField,
  SimpleTable,
  StatCard,
} from "@/components/supply-chain/shared";
import { WarehouseFilter } from "@/components/supply-chain/WarehouseFilter";
import { useMaterialShortages, useMaterials } from "@/hooks/useSupplyChain";
import { formatMoney, formatQuantity, humanizeEnum } from "@/lib/utils/decimal";
import type { ItemType } from "@/lib/api/types/supplyChain";

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
    limit: 25,
    search: search || undefined,
    warehouseId,
    itemType: itemType || undefined,
  });
  const { data: shortageData } = useMaterialShortages({ warehouseId });

  const shortages = shortageData?.data;

  return (
    <ProtectedRoute>
      <div className="space-y-5 p-4">
        <PageHeader
          title="Material management"
          subtitle="Manage materials and monitor availability against safety stock."
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

        <Panel>
          <div className="mb-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
            <div className="min-w-0 flex-[1_1_14rem]">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Search
              </label>
              <Input
                placeholder="Material code or name"
                value={search}
                onChange={event => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Material type
              </label>
              <SelectField
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
            </div>
          </div>

          <SimpleTable
            isLoading={isLoading}
            rows={materials}
            keyOf={row => row.id}
            rowClassName={row =>
              row.isBelowSafetyStock ? "bg-amber-50/40" : ""
            }
            empty="No materials yet. Set a product's item type to Raw Material, Component, Consumable or Packaging for it to appear here."
            columns={[
              {
                header: "Material",
                cell: row => (
                  <Link
                    href={`/inventory/stock/${row.id}`}
                    className="text-primary hover:underline"
                  >
                    <span className="font-mono text-xs">{row.code}</span>
                    <span className="ml-2 text-sm">{row.name}</span>
                  </Link>
                ),
              },
              { header: "Type", cell: row => humanizeEnum(row.itemType ?? "") },
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
                        ? "font-semibold text-amber-700"
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
                    <span className="text-xs font-medium text-emerald-700">
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
            totalItems={pagination?.totalItems}
            onChange={setPage}
          />
        </Panel>
      </div>
    </ProtectedRoute>
  );
}
