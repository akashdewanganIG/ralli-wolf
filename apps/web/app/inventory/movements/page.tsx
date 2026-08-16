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
} from "@/components/supply-chain/shared";
import { WarehouseFilter } from "@/components/supply-chain/WarehouseFilter";
import { useStockMovements } from "@/hooks/useSupplyChain";
import {
  formatDateTime,
  formatMoney,
  formatQuantity,
  humanizeEnum,
} from "@/lib/utils/decimal";
import type { StockMovementType } from "@/lib/api/types/supplyChain";

const MOVEMENT_TYPES: StockMovementType[] = [
  "OPENING_BALANCE",
  "PURCHASE_RECEIPT",
  "PURCHASE_RETURN",
  "SALES_ISSUE",
  "SALES_RETURN",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "INTERNAL_MOVE",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "PRODUCTION_CONSUMPTION",
  "PRODUCTION_RECEIPT",
  "SCRAP",
  "CYCLE_COUNT_GAIN",
  "CYCLE_COUNT_LOSS",
  "EXPIRY_WRITE_OFF",
];

/** Default to the last 90 days, matching the API's own window. */
function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 90);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function StockLedgerPage() {
  const initial = defaultRange();
  const [page, setPage] = useState(1);
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [movementType, setMovementType] = useState("");
  const [direction, setDirection] = useState("");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const { movements, pagination, isLoading, error } = useStockMovements({
    page,
    limit: 50,
    warehouseId,
    movementType: movementType || undefined,
    direction: direction || undefined,
    from,
    to,
  });

  return (
    <ProtectedRoute>
      <div className="space-y-5 p-4">
        <PageHeader
          title="Stock ledger"
          subtitle="Trace every stock receipt, issue, transfer, and adjustment."
        />

        <ErrorBanner error={error} />

        <Panel>
          <div className="mb-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
            <div className="w-full sm:w-56">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Warehouse
              </label>
              <WarehouseFilter
                value={warehouseId}
                onChange={value => {
                  setWarehouseId(value);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-56">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Movement type
              </label>
              <SelectField
                value={movementType}
                onChange={event => {
                  setMovementType(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All types</option>
                {MOVEMENT_TYPES.map(type => (
                  <option key={type} value={type}>
                    {humanizeEnum(type)}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="w-full sm:w-40">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Direction
              </label>
              <SelectField
                value={direction}
                onChange={event => {
                  setDirection(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Any</option>
                <option value="IN">In</option>
                <option value="OUT">Out</option>
                <option value="INTERNAL">Internal</option>
              </SelectField>
            </div>
            <div className="w-full sm:w-40">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                From
              </label>
              <Input
                type="date"
                value={from}
                onChange={event => {
                  setFrom(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-40">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                To
              </label>
              <Input
                type="date"
                value={to}
                onChange={event => {
                  setTo(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <SimpleTable
            isLoading={isLoading}
            rows={movements}
            keyOf={row => row.id}
            empty="No movements in this period. Receive or issue stock to populate the ledger."
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
              { header: "Type", cell: row => humanizeEnum(row.movementType) },
              {
                header: "Dir",
                cell: row => (
                  <span
                    className={
                      row.direction === "IN"
                        ? "font-medium text-emerald-700"
                        : row.direction === "OUT"
                          ? "font-medium text-red-700"
                          : "font-medium text-blue-700"
                    }
                  >
                    {row.direction === "IN"
                      ? "↓"
                      : row.direction === "OUT"
                        ? "↑"
                        : "↔"}
                  </span>
                ),
              },
              {
                header: "Lot",
                cell: row => (
                  <span className="font-mono text-xs">
                    {row.lot?.lotNumber ?? "—"}
                  </span>
                ),
              },
              {
                header: "From → To",
                cell: row =>
                  `${row.fromBin?.code ?? row.fromWarehouse?.code ?? "—"} → ${row.toBin?.code ?? row.toWarehouse?.code ?? "—"}`,
              },
              {
                header: "Qty",
                align: "right",
                cell: row => formatQuantity(row.quantity),
              },
              {
                header: "Unit cost",
                align: "right",
                cell: row => formatMoney(row.unitCost),
              },
              {
                header: "Value",
                align: "right",
                cell: row => formatMoney(row.totalCost),
              },
              {
                header: "Reference",
                cell: row =>
                  row.referenceNumber ?? humanizeEnum(row.referenceType ?? ""),
              },
              {
                header: "By",
                cell: row =>
                  row.performedBy
                    ? `${row.performedBy.firstName ?? ""} ${row.performedBy.lastName ?? ""}`.trim() ||
                      "—"
                    : "System",
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
