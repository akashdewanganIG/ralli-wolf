"use client";

import { useState } from "react";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  ErrorBanner,
  PageHeader,
  Pager,
  Panel,
  SelectField,
  SimpleTable,
  StatusBadge,
  DEFAULT_PAGE_SIZE,
} from "@/components/supply-chain/shared";
import { WarehouseFilter } from "@/components/supply-chain/WarehouseFilter";
import { useStockPositions } from "@/hooks/useSupplyChain";
import { formatMoney, formatQuantity, humanizeEnum } from "@/lib/utils/decimal";
import type { ItemType, StockPositionRow } from "@/lib/api/types/supplyChain";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { DashboardToolbar } from "@repo/ui/components/ui/dashboard-toolbar";
import { SearchInput } from "@repo/ui/components/ui/search-input";
import { Tag } from "@repo/ui/components/ui/tag";
import { DataTransfer } from "@/components/data-transfer/DataTransfer";

const ITEM_TYPES: ItemType[] = [
  "FINISHED_GOOD",
  "ACCESSORY",
  "SPARE_PART",
  "RAW_MATERIAL",
  "COMPONENT",
  "CONSUMABLE",
  "PACKAGING",
];

export default function StockPositionsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [itemType, setItemType] = useState<string>("");
  const [belowReorder, setBelowReorder] = useState(false);

  const { rows, pagination, isLoading, error } = useStockPositions({
    page,
    limit: DEFAULT_PAGE_SIZE,
    search: search || undefined,
    warehouseId,
    itemType: itemType || undefined,
    belowReorder: belowReorder || undefined,
  });

  const resetToFirstPage = () => setPage(1);

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Stock positions"
          subtitle="What you hold, what is already promised, and what is free to sell."
          actions={<DataTransfer entity="stock-positions" />}
        />

        <ErrorBanner error={error} />

        <Panel
          flush
          actions={
            <DashboardToolbar
              search={
                <SearchInput
                  placeholder="Search item code, name or barcode"
                  value={search}
                  onChange={event => {
                    setSearch(event.target.value);
                    resetToFirstPage();
                  }}
                />
              }
              actions={[
                <WarehouseFilter
                  key="warehouse"
                  value={warehouseId}
                  onChange={value => {
                    setWarehouseId(value);
                    resetToFirstPage();
                  }}
                />,
                <SelectField
                  key="item-type"
                  aria-label="Filter by item type"
                  className="w-full sm:w-44"
                  value={itemType}
                  onChange={event => {
                    setItemType(event.target.value);
                    resetToFirstPage();
                  }}
                >
                  <option value="">All types</option>
                  {ITEM_TYPES.map(type => (
                    <option key={type} value={type}>
                      {humanizeEnum(type)}
                    </option>
                  ))}
                </SelectField>,
                <label
                  key="below-reorder"
                  className="flex h-9 shrink-0 items-center gap-2 whitespace-nowrap text-[0.8125rem]"
                >
                  <Checkbox
                    checked={belowReorder}
                    onCheckedChange={checked => {
                      setBelowReorder(checked);
                      resetToFirstPage();
                    }}
                  />
                  Below reorder point
                </label>,
              ]}
            />
          }
        >
          <SimpleTable<StockPositionRow>
            isLoading={isLoading}
            rows={rows}
            keyOf={row => row.product.id}
            onRowClick={row =>
              router.push(
                `/inventory/stock/${row.product.id}${warehouseId ? `?warehouseId=${warehouseId}` : ""}`
              )
            }
            rowClassName={row =>
              row.isStockedOut
                ? "bg-error-surface/40"
                : row.isBelowSafetyStock
                  ? "bg-warning-surface/40"
                  : ""
            }
            empty={
              search || itemType || belowReorder
                ? "No items match these filters."
                : "No stock-tracked items yet. Mark products as stock tracked and receive stock to see positions here."
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
                header: "Type",
                cell: row =>
                  row.product.itemType ? (
                    <Tag>{row.product.itemType}</Tag>
                  ) : (
                    "—"
                  ),
              },
              { header: "UoM", cell: row => row.product.uom?.code ?? "—" },
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
                      row.isStockedOut
                        ? "font-semibold text-error-foreground"
                        : row.isBelowSafetyStock
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
                header: "Reorder point",
                align: "right",
                cell: row =>
                  row.reorderPoint === null ? (
                    <span className="text-muted-foreground">not set</span>
                  ) : (
                    formatQuantity(row.reorderPoint)
                  ),
              },
              {
                header: "Value",
                align: "right",
                cell: row => formatMoney(row.stockValue),
              },
              {
                header: "Status",
                cell: row =>
                  row.isStockedOut ? (
                    <StatusBadge
                      status="BLOCKED"
                      className="!bg-error-surface !text-error-foreground"
                    />
                  ) : row.isBelowSafetyStock ? (
                    <StatusBadge status="PENDING" />
                  ) : (
                    <StatusBadge status="AVAILABLE" />
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
