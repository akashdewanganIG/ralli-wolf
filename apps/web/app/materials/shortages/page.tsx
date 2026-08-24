"use client";

import { useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  ErrorBanner,
  PageHeader,
  Panel,
  SimpleTable,
  StatCard,
} from "@/components/supply-chain/shared";
import { WarehouseFilter } from "@/components/supply-chain/WarehouseFilter";
import { useMaterialShortages } from "@/hooks/useSupplyChain";
import { formatMoney, formatQuantity, humanizeEnum } from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { Tag } from "@repo/ui/components/ui/tag";

export default function MaterialShortagesPage() {
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const { data, isLoading, error } = useMaterialShortages({ warehouseId });

  const shortages = data?.data;

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Material shortages"
          subtitle="Parts you are short of that could stop planned work."
          actions={
            <WarehouseFilter
              value={warehouseId}
              onChange={setWarehouseId}
              className="w-full sm:w-56"
            />
          }
        />

        <ErrorBanner error={error} />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Materials short"
            value={isLoading ? "—" : (shortages?.totalShortages ?? 0)}
            tone={shortages?.totalShortages ? "warning" : "positive"}
          />
          <StatCard
            label="Fully stocked out"
            value={isLoading ? "—" : (shortages?.criticalShortages ?? 0)}
            tone={shortages?.criticalShortages ? "critical" : "positive"}
            hint="Nothing free to issue"
          />
          <StatCard
            label="Estimated cost to cover"
            value={
              isLoading
                ? "—"
                : formatMoney(
                    (shortages?.rows ?? []).reduce(
                      (acc, row) => acc + Number(row.estimatedValue),
                      0
                    )
                  )
            }
            hint="At standard cost"
          />
        </div>

        <Panel
          flush
          title="Shortage worklist"
          description="Parts you do not have enough of, worst shortage first."
        >
          <SimpleTable
            isLoading={isLoading}
            rows={shortages?.rows ?? []}
            keyOf={row => `${row.product.id}-${row.warehouse.id}`}
            rowClassName={row =>
              Number(row.availableQuantity) <= 0
                ? "bg-error-surface/40"
                : "bg-warning-surface/30"
            }
            empty="Nothing is below its safety stock. Configure reorder policies for materials that should be watched."
            columns={[
              {
                header: "Material",
                cell: row => (
                  <Link
                    href={`/inventory/stock/${row.product.id}?warehouseId=${row.warehouse.id}`}
                    className="text-primary hover:text-info"
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
                cell: row =>
                  row.product.itemType ? (
                    <Tag>{row.product.itemType}</Tag>
                  ) : (
                    "—"
                  ),
              },
              { header: "Warehouse", cell: row => row.warehouse.code },
              {
                header: "On hand",
                align: "right",
                cell: row => formatQuantity(row.onHandQuantity),
              },
              {
                header: "Available",
                align: "right",
                cell: row => (
                  <span
                    className={
                      Number(row.availableQuantity) <= 0
                        ? "font-semibold text-error-foreground"
                        : "font-semibold text-warning-foreground"
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
                header: "Projected",
                align: "right",
                cell: row => formatQuantity(row.projectedQuantity),
              },
              {
                header: "Safety stock",
                align: "right",
                cell: row => formatQuantity(row.safetyStock),
              },
              {
                header: "Short by",
                align: "right",
                cell: row => (
                  <span className="font-semibold text-error-foreground">
                    {formatQuantity(row.shortfallQuantity)}
                  </span>
                ),
              },
              {
                header: "Suggested order",
                align: "right",
                cell: row => formatQuantity(row.reorderQuantity),
              },
              {
                header: "Lead time",
                align: "right",
                cell: row => `${row.leadTimeDays}d`,
              },
              {
                header: "Preferred supplier",
                cell: row =>
                  row.preferredSupplier?.name ?? (
                    <span className="text-muted-foreground">not set</span>
                  ),
              },
              {
                header: "Est. value",
                align: "right",
                cell: row => formatMoney(row.estimatedValue),
              },
              {
                header: "Auto PR",
                cell: row =>
                  row.autoRequisition ? (
                    <span className="text-xs font-medium text-success-foreground">
                      Automated
                    </span>
                  ) : (
                    <Link
                      href="/purchasing/requisitions"
                      className="text-xs text-primary hover:text-info"
                    >
                      Raise manually
                    </Link>
                  ),
              },
            ]}
          />
        </Panel>
      </PageShell>
    </ProtectedRoute>
  );
}
