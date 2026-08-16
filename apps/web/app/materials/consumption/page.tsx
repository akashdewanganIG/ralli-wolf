"use client";

import { useState } from "react";
import { Input } from "@repo/ui/components/ui/input";
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
import { useConsumptionReport } from "@/hooks/useSupplyChain";
import {
  formatMoney,
  formatPercent,
  formatQuantity,
  humanizeEnum,
} from "@/lib/utils/decimal";
import type { ItemType } from "@/lib/api/types/supplyChain";

const MATERIAL_TYPES: ItemType[] = [
  "RAW_MATERIAL",
  "COMPONENT",
  "CONSUMABLE",
  "PACKAGING",
];

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function ConsumptionReportPage() {
  const initial = defaultRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [itemType, setItemType] = useState("");

  const { data, isLoading, error } = useConsumptionReport({
    from,
    to,
    warehouseId,
    itemType: itemType || undefined,
  });

  const report = data?.data;

  return (
    <ProtectedRoute>
      <div className="space-y-5 p-4">
        <PageHeader
          title="Consumption & wastage"
          subtitle="Review material issues, production usage, and write-offs."
          actions={
            <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
              <Input
                type="date"
                className="w-full sm:w-40"
                value={from}
                onChange={event => setFrom(event.target.value)}
              />
              <Input
                type="date"
                className="w-full sm:w-40"
                value={to}
                onChange={event => setTo(event.target.value)}
              />
              <WarehouseFilter
                value={warehouseId}
                onChange={setWarehouseId}
                className="w-full sm:w-52"
              />
              <SelectField
                className="w-full sm:w-44"
                value={itemType}
                onChange={event => setItemType(event.target.value)}
              >
                <option value="">All material types</option>
                {MATERIAL_TYPES.map(type => (
                  <option key={type} value={type}>
                    {humanizeEnum(type)}
                  </option>
                ))}
              </SelectField>
            </div>
          }
        />

        <ErrorBanner error={error} />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Consumed value"
            value={isLoading ? "—" : formatMoney(report?.totals.consumedValue)}
            tone="info"
          />
          <StatCard
            label="Wasted (scrap)"
            value={isLoading ? "—" : formatMoney(report?.totals.wastedValue)}
            tone="warning"
          />
          <StatCard
            label="Expired write-offs"
            value={isLoading ? "—" : formatMoney(report?.totals.expiredValue)}
            tone="critical"
          />
          <StatCard
            label="Wastage rate"
            value={
              isLoading ? "—" : formatPercent(report?.totals.wastagePercent)
            }
            hint="Scrap and expiry as a share of everything issued"
            tone={
              Number(report?.totals.wastagePercent ?? 0) > 5
                ? "critical"
                : "positive"
            }
          />
        </div>

        <Panel title="By material" description="Highest total value first">
          <SimpleTable
            isLoading={isLoading}
            rows={report?.rows ?? []}
            keyOf={row => row.productId}
            empty="No material was issued, scrapped or written off in this period."
            rowClassName={row =>
              Number(row.wastagePercent) > 10 ? "bg-red-50/40" : ""
            }
            columns={[
              {
                header: "Material",
                cell: row => (
                  <Link
                    href={`/inventory/stock/${row.productId}`}
                    className="text-primary hover:underline"
                  >
                    <span className="font-mono text-xs">{row.productCode}</span>
                    <span className="ml-2 text-sm">{row.productName}</span>
                  </Link>
                ),
              },
              { header: "Type", cell: row => humanizeEnum(row.itemType) },
              { header: "UoM", cell: row => row.uomCode ?? "—" },
              {
                header: "Consumed",
                align: "right",
                cell: row => formatQuantity(row.consumedQuantity),
              },
              {
                header: "Scrapped",
                align: "right",
                cell: row => formatQuantity(row.wastedQuantity),
              },
              {
                header: "Expired",
                align: "right",
                cell: row => formatQuantity(row.expiredQuantity),
              },
              {
                header: "Total issued",
                align: "right",
                cell: row => formatQuantity(row.totalIssuedQuantity),
              },
              {
                header: "Wastage %",
                align: "right",
                cell: row => (
                  <span
                    className={
                      Number(row.wastagePercent) > 10
                        ? "font-semibold text-red-700"
                        : Number(row.wastagePercent) > 5
                          ? "font-semibold text-amber-700"
                          : ""
                    }
                  >
                    {formatPercent(row.wastagePercent)}
                  </span>
                ),
              },
              {
                header: "Wastage value",
                align: "right",
                cell: row => formatMoney(row.wastageValue),
              },
              {
                header: "Total value",
                align: "right",
                cell: row => (
                  <span className="font-medium">
                    {formatMoney(row.totalValue)}
                  </span>
                ),
              },
            ]}
          />
        </Panel>
      </div>
    </ProtectedRoute>
  );
}
