"use client";

import { useState } from "react";
import { Input } from "@repo/ui/components/ui/input";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  ErrorBanner,
  FilterBar,
  PageHeader,
  Pager,
  Panel,
  SelectField,
  SimpleTable,
  StatusBadge,
  DEFAULT_PAGE_SIZE,
} from "@/components/supply-chain/shared";
import { WarehouseFilter } from "@/components/supply-chain/WarehouseFilter";
import { useGoodsReceipts, useSuppliers } from "@/hooks/useSupplyChain";
import {
  formatDate,
  formatMoney,
  formatQuantity,
  humanizeEnum,
} from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";

export default function GoodsReceiptsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);

  const { receipts, pagination, isLoading, error } = useGoodsReceipts({
    page,
    limit: DEFAULT_PAGE_SIZE,
    status: status || undefined,
    search: search || undefined,
    supplierId: supplierId ? Number(supplierId) : undefined,
    warehouseId,
  });
  const { suppliers } = useSuppliers({ limit: 200 });

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Goods receipts"
          subtitle="Deliveries that have arrived, and what happened to them afterwards."
        />

        <ErrorBanner error={error} />

        <Panel
          flush
          actions={
            <FilterBar>
              <SelectField
                className="w-full sm:w-44"
                value={status}
                onChange={event => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {[
                  "DRAFT",
                  "PENDING_QC",
                  "QC_IN_PROGRESS",
                  "COMPLETED",
                  "CANCELLED",
                ].map(value => (
                  <option key={value} value={value}>
                    {humanizeEnum(value)}
                  </option>
                ))}
              </SelectField>
              <SelectField
                className="w-full sm:w-48"
                value={supplierId}
                onChange={event => {
                  setSupplierId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All suppliers</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </SelectField>
              <div className="w-full sm:w-52">
                <WarehouseFilter
                  value={warehouseId}
                  onChange={value => {
                    setWarehouseId(value);
                    setPage(1);
                  }}
                />
              </div>
              <Input
                className="w-full sm:w-52"
                placeholder="GRN or invoice number"
                value={search}
                onChange={event => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </FilterBar>
          }
        >
          <SimpleTable
            isLoading={isLoading}
            rows={receipts}
            keyOf={row => row.id}
            onRowClick={row =>
              router.push(`/purchasing/goods-receipts/${row.id}`)
            }
            rowClassName={row =>
              row.isOnTime === false ? "bg-warning-surface/40" : ""
            }
            empty="No goods receipts yet. Receive against a purchase order to create one."
            columns={[
              {
                header: "GRN",
                cell: row => (
                  <span className="font-mono text-xs text-primary">
                    {row.grnNumber}
                  </span>
                ),
              },
              { header: "Supplier", cell: row => row.supplier.name },
              { header: "PO", cell: row => row.purchaseOrder?.poNumber ?? "—" },
              { header: "Warehouse", cell: row => row.warehouse.code },
              { header: "Received", cell: row => formatDate(row.receivedDate) },
              {
                header: "On time",
                cell: row =>
                  row.isOnTime === null ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : row.isOnTime ? (
                    <span className="text-xs font-medium text-success-foreground">
                      Yes
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-error-foreground">
                      {row.delayDays}d late
                    </span>
                  ),
              },
              {
                header: "Invoice",
                cell: row => row.supplierInvoiceNumber ?? "—",
              },
              {
                header: "Lines",
                align: "right",
                cell: row => row._count?.lines ?? 0,
              },
              {
                header: "Received qty",
                align: "right",
                cell: row => formatQuantity(row.totalReceivedQuantity),
              },
              {
                header: "Accepted",
                align: "right",
                cell: row => formatQuantity(row.totalAcceptedQuantity),
              },
              {
                header: "Rejected",
                align: "right",
                cell: row =>
                  Number(row.totalRejectedQuantity) > 0 ? (
                    <span className="font-semibold text-error-foreground">
                      {formatQuantity(row.totalRejectedQuantity)}
                    </span>
                  ) : (
                    "—"
                  ),
              },
              {
                header: "Value",
                align: "right",
                cell: row => formatMoney(row.totalValue),
              },
              {
                header: "Status",
                cell: row => <StatusBadge status={row.status} />,
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
