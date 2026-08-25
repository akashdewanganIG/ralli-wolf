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
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { DashboardToolbar } from "@repo/ui/components/ui/dashboard-toolbar";
import { Tag } from "@repo/ui/components/ui/tag";
import { DataTransfer } from "@/components/data-transfer/DataTransfer";

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
      <PageShell>
        <PageHeader
          title="Stock ledger"
          subtitle="A full history of stock arriving, leaving, and moving between places."
          actions={<DataTransfer entity="stock-movements" />}
        />

        <ErrorBanner error={error} />

        <Panel
          title="Movements"
          flush
          actions={
            <DashboardToolbar
              actions={[
                <WarehouseFilter
                  key="warehouse"
                  value={warehouseId}
                  onChange={value => {
                    setWarehouseId(value);
                    setPage(1);
                  }}
                />,
                <SelectField
                  key="movement-type"
                  aria-label="Filter by movement type"
                  className="w-full sm:w-48"
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
                </SelectField>,
                <SelectField
                  key="direction"
                  aria-label="Filter by direction"
                  className="w-full sm:w-36"
                  value={direction}
                  onChange={event => {
                    setDirection(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Any direction</option>
                  <option value="IN">In</option>
                  <option value="OUT">Out</option>
                  <option value="INTERNAL">Internal</option>
                </SelectField>,
                // Two adjacent date fields need naming: a date input shows
                // "dd/mm/yyyy" either way, so a placeholder cannot say which
                // end of the range it is. The label sits inline rather than
                // stacked, which keeps the control on the toolbar's row.
                <label
                  key="from"
                  className="flex h-9 shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
                >
                  From
                  <Input
                    type="date"
                    className="w-36"
                    value={from}
                    onChange={event => {
                      setFrom(event.target.value);
                      setPage(1);
                    }}
                  />
                </label>,
                <label
                  key="to"
                  className="flex h-9 shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
                >
                  To
                  <Input
                    type="date"
                    className="w-36"
                    value={to}
                    onChange={event => {
                      setTo(event.target.value);
                      setPage(1);
                    }}
                  />
                </label>,
              ]}
            />
          }
        >
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
                  row.movementType ? <Tag>{row.movementType}</Tag> : "—",
              },
              {
                header: "Dir",
                cell: row => (
                  <span
                    className={
                      row.direction === "IN"
                        ? "font-medium text-success-foreground"
                        : row.direction === "OUT"
                          ? "font-medium text-error-foreground"
                          : "font-medium text-info-foreground"
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
            onChange={setPage}
          />
        </Panel>
      </PageShell>
    </ProtectedRoute>
  );
}
