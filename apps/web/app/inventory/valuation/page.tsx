"use client";

import { useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  ErrorBanner,
  PageHeader,
  Panel,
  SelectField,
  SimpleTable,
  StatCard,
} from "@/components/supply-chain/shared";
import { WarehouseFilter } from "@/components/supply-chain/WarehouseFilter";
import { useInventoryValuation } from "@/hooks/useSupplyChain";
import { formatMoney, formatQuantity, humanizeEnum } from "@/lib/utils/decimal";
import type { ItemType } from "@/lib/api/types/supplyChain";

const ITEM_TYPES: ItemType[] = [
  "FINISHED_GOOD",
  "ACCESSORY",
  "SPARE_PART",
  "RAW_MATERIAL",
  "COMPONENT",
  "CONSUMABLE",
  "PACKAGING",
];

export default function InventoryValuationPage() {
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [itemType, setItemType] = useState("");
  const { data, isLoading, error } = useInventoryValuation({
    warehouseId,
    itemType: itemType || undefined,
  });

  const valuation = data?.data;

  return (
    <ProtectedRoute>
      <div className="space-y-5 p-4">
        <PageHeader
          title="Inventory valuation"
          subtitle="Review inventory value by item and warehouse."
          actions={
            <>
              <WarehouseFilter
                value={warehouseId}
                onChange={setWarehouseId}
                className="w-full sm:w-56"
              />
              <SelectField
                className="w-full sm:w-48"
                value={itemType}
                onChange={event => setItemType(event.target.value)}
              >
                <option value="">All item types</option>
                {ITEM_TYPES.map(type => (
                  <option key={type} value={type}>
                    {humanizeEnum(type)}
                  </option>
                ))}
              </SelectField>
            </>
          }
        />

        <ErrorBanner error={error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Total stock value"
            value={isLoading ? "—" : formatMoney(valuation?.totalValue)}
          />
          <StatCard
            label="Distinct items held"
            value={isLoading ? "—" : (valuation?.distinctItems ?? 0)}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="By warehouse">
            <SimpleTable
              isLoading={isLoading}
              rows={valuation?.byWarehouse ?? []}
              keyOf={row => row.warehouse.id}
              empty="No stock on hand."
              columns={[
                {
                  header: "Warehouse",
                  cell: row => `${row.warehouse.code} — ${row.warehouse.name}`,
                },
                {
                  header: "Quantity",
                  align: "right",
                  cell: row => formatQuantity(row.quantity),
                },
                {
                  header: "Value",
                  align: "right",
                  cell: row => formatMoney(row.value),
                },
              ]}
            />
          </Panel>
          <Panel title="By item type">
            <SimpleTable
              isLoading={isLoading}
              rows={valuation?.byItemType ?? []}
              keyOf={row => row.itemType}
              empty="No stock on hand."
              columns={[
                {
                  header: "Item type",
                  cell: row => humanizeEnum(row.itemType),
                },
                {
                  header: "Quantity",
                  align: "right",
                  cell: row => formatQuantity(row.quantity),
                },
                {
                  header: "Value",
                  align: "right",
                  cell: row => formatMoney(row.value),
                },
              ]}
            />
          </Panel>
        </div>

        <Panel title="By item" description="Highest value first">
          <SimpleTable
            isLoading={isLoading}
            rows={valuation?.products ?? []}
            keyOf={row => row.product.id}
            empty="No stock on hand to value."
            columns={[
              {
                header: "Item",
                cell: row => (
                  <Link
                    href={`/inventory/stock/${row.product.id}`}
                    className="text-primary hover:underline"
                  >
                    <span className="font-mono text-xs">
                      {row.product.code}
                    </span>
                    <span className="ml-2 text-sm">{row.product.name}</span>
                  </Link>
                ),
              },
              {
                header: "Type",
                cell: row => humanizeEnum(row.product.itemType ?? ""),
              },
              { header: "UoM", cell: row => row.product.uom?.code ?? "—" },
              {
                header: "Quantity",
                align: "right",
                cell: row => formatQuantity(row.quantity),
              },
              {
                header: "Avg unit cost",
                align: "right",
                cell: row => formatMoney(row.averageUnitCost),
              },
              {
                header: "Value",
                align: "right",
                cell: row => (
                  <span className="font-medium">{formatMoney(row.value)}</span>
                ),
              },
            ]}
          />
        </Panel>
      </div>
    </ProtectedRoute>
  );
}
