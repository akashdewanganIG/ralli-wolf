"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  ErrorBanner,
  FilterBar,
  Field,
  PageHeader,
  Pager,
  Panel,
  SelectField,
  SimpleTable,
  StatusBadge,
  DEFAULT_PAGE_SIZE,
} from "@/components/supply-chain/shared";
import { WarehouseFilter } from "@/components/supply-chain/WarehouseFilter";
import {
  ProductPicker,
  type PickedProduct,
} from "@/components/supply-chain/ProductPicker";
import {
  useProductionMutations,
  useProductionOrders,
} from "@/hooks/useSupplyChain";
import {
  formatDate,
  formatMoney,
  formatQuantity,
  humanizeEnum,
} from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { FormDialog } from "@repo/ui/components/ui/form-dialog";

export default function ProductionOrdersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [filterWarehouseId, setFilterWarehouseId] = useState<
    number | undefined
  >(undefined);
  const [showForm, setShowForm] = useState(false);

  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [plannedQuantity, setPlannedQuantity] = useState("");
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [notes, setNotes] = useState("");

  const { orders, pagination, isLoading, error } = useProductionOrders({
    page,
    limit: DEFAULT_PAGE_SIZE,
    status: status || undefined,
    warehouseId: filterWarehouseId,
  });
  const { create } = useProductionMutations();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!product || !warehouseId || !plannedQuantity) return;
    create.mutate(
      {
        productId: product.id,
        warehouseId,
        plannedQuantity,
        plannedStartDate: plannedStartDate || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: result => {
          setShowForm(false);
          setProduct(null);
          setPlannedQuantity("");
          router.push(`/production/${(result.data as { id: number }).id}`);
        },
      }
    );
  };

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Production orders"
          subtitle="Plan and track production against a fixed bill of materials."
          actions={
            <Button
              type="button"
              onClick={() => setShowForm(true)}
              className="px-3 whitespace-nowrap"
            >
              New production order
            </Button>
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={create.error} />

        <FormDialog
          open={showForm}
          onOpenChange={setShowForm}
          title="Plan a build"
          description="The product needs an active bill of materials in effect today."
        >
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
            <Field label="Product to build" className="md:col-span-2" composite>
              <ProductPicker value={product} onChange={setProduct} autoFocus />
            </Field>
            <Field label="Build in warehouse" composite>
              <WarehouseFilter
                value={warehouseId}
                onChange={setWarehouseId}
                allowAll={false}
                required
              />
            </Field>
            <Field label="Planned quantity">
              <Input
                required
                inputMode="decimal"
                value={plannedQuantity}
                onChange={event => setPlannedQuantity(event.target.value)}
              />
            </Field>
            <Field label="Planned start">
              <Input
                type="date"
                value={plannedStartDate}
                onChange={event => setPlannedStartDate(event.target.value)}
              />
            </Field>
            <Field label="Notes" className="md:col-span-3">
              <Input
                value={notes}
                onChange={event => setNotes(event.target.value)}
              />
            </Field>
            <div className="md:col-span-4 dialog-form-actions">
              <Button
                type="submit"
                disabled={
                  !product ||
                  !warehouseId ||
                  !plannedQuantity ||
                  create.isPending
                }
              >
                {create.isPending ? "Planning…" : "Create production order"}
              </Button>
            </div>
          </form>
        </FormDialog>

        <Panel
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
                  "PLANNED",
                  "RELEASED",
                  "IN_PROGRESS",
                  "COMPLETED",
                  "CLOSED",
                  "CANCELLED",
                ].map(value => (
                  <option key={value} value={value}>
                    {humanizeEnum(value)}
                  </option>
                ))}
              </SelectField>
              <div className="w-full sm:w-56">
                <WarehouseFilter
                  value={filterWarehouseId}
                  onChange={value => {
                    setFilterWarehouseId(value);
                    setPage(1);
                  }}
                />
              </div>
            </FilterBar>
          }
        >
          <SimpleTable
            isLoading={isLoading}
            rows={orders}
            keyOf={row => row.id}
            onRowClick={row => router.push(`/production/${row.id}`)}
            empty="No production orders yet."
            columns={[
              {
                header: "Order",
                cell: row => (
                  <span className="font-mono text-xs text-primary">
                    {row.orderNumber}
                  </span>
                ),
              },
              {
                header: "Builds",
                cell: row => (
                  <div>
                    <p className="font-mono text-xs">{row.product.code}</p>
                    <p className="text-sm">{row.product.name}</p>
                  </div>
                ),
              },
              {
                header: "BOM",
                cell: row =>
                  `${row.bom.bomNumber} v${row.bom.version}${row.bom.revision}`,
              },
              { header: "Warehouse", cell: row => row.warehouse.code },
              {
                header: "Planned",
                align: "right",
                cell: row => formatQuantity(row.plannedQuantity),
              },
              {
                header: "Produced",
                align: "right",
                cell: row => formatQuantity(row.producedQuantity),
              },
              {
                header: "Scrapped",
                align: "right",
                cell: row =>
                  Number(row.scrappedQuantity) > 0 ? (
                    <span className="text-error-foreground">
                      {formatQuantity(row.scrappedQuantity)}
                    </span>
                  ) : (
                    "—"
                  ),
              },
              {
                header: "Planned cost",
                align: "right",
                cell: row => formatMoney(row.plannedMaterialCost),
              },
              {
                header: "Actual cost",
                align: "right",
                cell: row => {
                  const variance =
                    Number(row.actualMaterialCost) -
                    Number(row.plannedMaterialCost);
                  return (
                    <span
                      className={
                        variance > 0
                          ? "text-error-foreground"
                          : variance < 0
                            ? "text-success-foreground"
                            : ""
                      }
                    >
                      {formatMoney(row.actualMaterialCost)}
                    </span>
                  );
                },
              },
              {
                header: "Start",
                cell: row => formatDate(row.plannedStartDate),
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
