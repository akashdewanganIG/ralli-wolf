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
} from "@/components/supply-chain/shared";
import { WarehouseFilter } from "@/components/supply-chain/WarehouseFilter";
import { useStockPositions } from "@/hooks/useSupplyChain";
import { formatMoney, formatQuantity, humanizeEnum } from "@/lib/utils/decimal";
import type { ItemType, StockPositionRow } from "@/lib/api/types/supplyChain";

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
    limit: 25,
    search: search || undefined,
    warehouseId,
    itemType: itemType || undefined,
    belowReorder: belowReorder || undefined,
  });

  const resetToFirstPage = () => setPage(1);

  return (
    <ProtectedRoute>
      <div className="space-y-5 p-4">
        <PageHeader
          title="Stock positions"
          subtitle="Review on-hand, reserved, and available inventory."
        />

        <ErrorBanner error={error} />

        <Panel>
          <div className="mb-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
            <div className="min-w-0 flex-[1_1_14rem]">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Search
              </label>
              <Input
                placeholder="Item code, name or barcode"
                value={search}
                onChange={event => {
                  setSearch(event.target.value);
                  resetToFirstPage();
                }}
              />
            </div>
            <div className="w-full sm:w-56">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Warehouse
              </label>
              <WarehouseFilter
                value={warehouseId}
                onChange={value => {
                  setWarehouseId(value);
                  resetToFirstPage();
                }}
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Item type
              </label>
              <SelectField
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
              </SelectField>
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Checkbox
                checked={belowReorder}
                onCheckedChange={checked => {
                  setBelowReorder(checked);
                  resetToFirstPage();
                }}
              />
              Below reorder point only
            </label>
          </div>

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
                ? "bg-red-50/40"
                : row.isBelowSafetyStock
                  ? "bg-amber-50/40"
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
                cell: row => humanizeEnum(row.product.itemType ?? ""),
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
                        ? "font-semibold text-red-700"
                        : row.isBelowSafetyStock
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
                      className="!bg-red-100 !text-red-800"
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
            totalItems={pagination?.totalItems}
            onChange={setPage}
          />
        </Panel>
      </div>
    </ProtectedRoute>
  );
}
