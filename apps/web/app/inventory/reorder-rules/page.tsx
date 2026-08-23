"use client";

import { useState } from "react";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  ErrorBanner,
  Field,
  PageHeader,
  Pager,
  Panel,
  SelectField,
  SimpleTable,
  DEFAULT_PAGE_SIZE,
} from "@/components/supply-chain/shared";
import { WarehouseFilter } from "@/components/supply-chain/WarehouseFilter";
import {
  ProductPicker,
  type PickedProduct,
} from "@/components/supply-chain/ProductPicker";
import {
  useInventoryMutations,
  useReorderRules,
  useSuppliers,
} from "@/hooks/useSupplyChain";
import { formatDateTime, formatQuantity } from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { FormDialog } from "@repo/ui/components/ui/form-dialog";

export default function ReorderRulesPage() {
  const [page, setPage] = useState(1);
  const [filterWarehouseId, setFilterWarehouseId] = useState<
    number | undefined
  >(undefined);
  const [showForm, setShowForm] = useState(false);

  const { rules, pagination, isLoading, error } = useReorderRules({
    page,
    limit: DEFAULT_PAGE_SIZE,
    warehouseId: filterWarehouseId,
  });
  const { saveReorderRule, deleteReorderRule } = useInventoryMutations();
  const { suppliers } = useSuppliers({ limit: 200, status: "ACTIVE" });

  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [safetyStock, setSafetyStock] = useState("0");
  const [reorderPoint, setReorderPoint] = useState("0");
  const [reorderQuantity, setReorderQuantity] = useState("0");
  const [maximumStock, setMaximumStock] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("0");
  const [autoRequisition, setAutoRequisition] = useState(false);
  const [preferredSupplierId, setPreferredSupplierId] = useState("");

  const resetForm = () => {
    setProduct(null);
    setWarehouseId(undefined);
    setSafetyStock("0");
    setReorderPoint("0");
    setReorderQuantity("0");
    setMaximumStock("");
    setLeadTimeDays("0");
    setAutoRequisition(false);
    setPreferredSupplierId("");
  };

  const canSubmit = !!product && !!warehouseId && !saveReorderRule.isPending;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!product || !warehouseId) return;

    saveReorderRule.mutate(
      {
        productId: product.id,
        warehouseId,
        safetyStock,
        reorderPoint,
        reorderQuantity,
        maximumStock: maximumStock || undefined,
        leadTimeDays: Number(leadTimeDays) || 0,
        autoRequisition,
        preferredSupplierId: preferredSupplierId
          ? Number(preferredSupplierId)
          : undefined,
      },
      {
        onSuccess: () => {
          resetForm();
          setShowForm(false);
        },
      }
    );
  };

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Reorder policies"
          subtitle="Manage replenishment policies by item and warehouse."
          actions={
            <Button
              type="button"
              onClick={() => setShowForm(true)}
              className="px-3 whitespace-nowrap"
            >
              Add / update policy
            </Button>
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={saveReorderRule.error} />
        <ErrorBanner error={deleteReorderRule.error} />

        <FormDialog
          open={showForm}
          onOpenChange={setShowForm}
          title="Reorder policy"
          description="Saving for an item and warehouse that already has a policy updates it."
        >
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-3">
            <Field label="Item" className="md:col-span-2" composite>
              <ProductPicker value={product} onChange={setProduct} autoFocus />
            </Field>
            <Field label="Warehouse" composite>
              <WarehouseFilter
                value={warehouseId}
                onChange={setWarehouseId}
                allowAll={false}
                required
              />
            </Field>

            <Field
              label="Safety stock"
              hint="The buffer you never want to dip below"
            >
              <Input
                value={safetyStock}
                onChange={e => setSafetyStock(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field
              label="Reorder point"
              hint="Must be at or above safety stock"
            >
              <Input
                value={reorderPoint}
                onChange={e => setReorderPoint(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field
              label="Reorder quantity"
              hint="How much to buy when triggered"
            >
              <Input
                value={reorderQuantity}
                onChange={e => setReorderQuantity(e.target.value)}
                inputMode="decimal"
              />
            </Field>

            <Field
              label="Maximum stock"
              hint="Optional. Above this an overstock alert is raised."
            >
              <Input
                value={maximumStock}
                onChange={e => setMaximumStock(e.target.value)}
                inputMode="decimal"
                placeholder="Not set"
              />
            </Field>
            <Field label="Lead time (days)">
              <Input
                value={leadTimeDays}
                onChange={e => setLeadTimeDays(e.target.value)}
                inputMode="numeric"
              />
            </Field>
            <Field label="Preferred supplier">
              <SelectField
                value={preferredSupplierId}
                onChange={e => setPreferredSupplierId(e.target.value)}
              >
                <option value="">None</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.code} — {supplier.name}
                  </option>
                ))}
              </SelectField>
            </Field>

            <label className="flex items-center gap-2 text-sm md:col-span-3">
              <Checkbox
                checked={autoRequisition}
                onCheckedChange={setAutoRequisition}
              />
              Raise a purchase requisition automatically when this item hits its
              reorder point
            </label>

            <div className="md:col-span-3 dialog-form-actions">
              <Button type="submit" disabled={!canSubmit}>
                {saveReorderRule.isPending ? "Saving…" : "Save policy"}
              </Button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border inline-flex items-center justify-center h-10 whitespace-nowrap px-4 text-sm hover:bg-muted"
              >
                Clear
              </button>
            </div>
          </form>
        </FormDialog>

        <Panel
          actions={
            <div className="w-full sm:w-56">
              <WarehouseFilter
                value={filterWarehouseId}
                onChange={value => {
                  setFilterWarehouseId(value);
                  setPage(1);
                }}
              />
            </div>
          }
          title="Configured policies"
        >
          <SimpleTable
            isLoading={isLoading}
            rows={rules}
            keyOf={row => row.id}
            empty="No reorder policies yet. Without one, the alert engine has no threshold to watch and will not warn you about a stockout."
            columns={[
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
              { header: "Warehouse", cell: row => row.warehouse.code },
              {
                header: "Available now",
                align: "right",
                cell: row => {
                  const available = Number(row.currentAvailable ?? 0);
                  const below = available <= Number(row.reorderPoint);
                  return (
                    <span
                      className={
                        below ? "font-semibold text-warning-foreground" : ""
                      }
                    >
                      {formatQuantity(row.currentAvailable ?? 0)}
                    </span>
                  );
                },
              },
              {
                header: "Safety stock",
                align: "right",
                cell: row => formatQuantity(row.safetyStock),
              },
              {
                header: "Reorder point",
                align: "right",
                cell: row => formatQuantity(row.reorderPoint),
              },
              {
                header: "Reorder qty",
                align: "right",
                cell: row => formatQuantity(row.reorderQuantity),
              },
              {
                header: "Max",
                align: "right",
                cell: row =>
                  row.maximumStock ? formatQuantity(row.maximumStock) : "—",
              },
              {
                header: "Lead time",
                align: "right",
                cell: row => `${row.leadTimeDays}d`,
              },
              {
                header: "Supplier",
                cell: row => row.preferredSupplier?.name ?? "—",
              },
              {
                header: "Auto PR",
                cell: row =>
                  row.autoRequisition ? (
                    <span className="text-xs font-medium text-success-foreground">
                      Yes
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No</span>
                  ),
              },
              {
                header: "Last checked",
                cell: row => formatDateTime(row.lastEvaluatedAt),
              },
              {
                header: "",
                cell: row => (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete the reorder policy for ${row.product.code} in ${row.warehouse.code}? Alerts will stop being raised for it.`
                        )
                      ) {
                        deleteReorderRule.mutate(row.id);
                      }
                    }}
                    className="rounded border px-2 py-1 text-xs text-error-foreground hover:bg-error-surface whitespace-nowrap"
                  >
                    Delete
                  </button>
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
