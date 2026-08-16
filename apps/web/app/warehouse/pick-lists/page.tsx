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
} from "@/components/supply-chain/shared";
import { WarehouseFilter } from "@/components/supply-chain/WarehouseFilter";
import {
  ProductPicker,
  type PickedProduct,
} from "@/components/supply-chain/ProductPicker";
import { usePickLists, useWmsMutations } from "@/hooks/useSupplyChain";
import { useSalesOrdersWithPagination } from "@/hooks/useSalesOrders";
import { formatDateTime, humanizeEnum } from "@/lib/utils/decimal";

interface DraftLine {
  product: PickedProduct | null;
  quantity: string;
}

export default function PickListsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filterWarehouseId, setFilterWarehouseId] = useState<
    number | undefined
  >(undefined);
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [source, setSource] = useState<"SALES_ORDER" | "MANUAL">("SALES_ORDER");
  const [salesOrderId, setSalesOrderId] = useState("");
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [strategy, setStrategy] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { product: null, quantity: "" },
  ]);

  const { pickLists, pagination, isLoading, error } = usePickLists({
    page,
    limit: 25,
    warehouseId: filterWarehouseId,
    status: status || undefined,
  });
  const { data: salesOrders } = useSalesOrdersWithPagination({
    page: 1,
    limit: 100,
  });
  const { createPickList } = useWmsMutations();

  const validLines = lines.filter(
    line => line.product && Number(line.quantity) > 0
  );
  const canSubmit =
    !!warehouseId &&
    !createPickList.isPending &&
    (source === "SALES_ORDER" ? !!salesOrderId : validLines.length > 0);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!warehouseId) return;

    createPickList.mutate(
      source === "SALES_ORDER"
        ? {
            warehouseId,
            salesOrderId: Number(salesOrderId),
            strategy: strategy || undefined,
          }
        : {
            warehouseId,
            strategy: strategy || undefined,
            referenceType: "MANUAL",
            lines: validLines.map(line => ({
              productId: line.product!.id,
              quantity: line.quantity,
            })),
          },
      {
        onSuccess: result => {
          setShowForm(false);
          setLines([{ product: null, quantity: "" }]);
          setSalesOrderId("");
          router.push(
            `/warehouse/pick-lists/${(result.data as { id: number }).id}`
          );
        },
      }
    );
  };

  return (
    <ProtectedRoute>
      <div className="space-y-5 p-4">
        <PageHeader
          title="Pick lists"
          subtitle="Create and track warehouse picking work."
          actions={
            <Button
              type="button"
              onClick={() => setShowForm(current => !current)}
              className="px-3 whitespace-nowrap"
            >
              {showForm ? "Close" : "New pick list"}
            </Button>
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={createPickList.error} />

        {showForm && (
          <Panel title="New pick list">
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="Pick for">
                  <SelectField
                    value={source}
                    onChange={event =>
                      setSource(event.target.value as "SALES_ORDER" | "MANUAL")
                    }
                  >
                    <option value="SALES_ORDER">A sales order</option>
                    <option value="MANUAL">Ad-hoc lines</option>
                  </SelectField>
                </Field>
                <Field label="Pick from warehouse" composite>
                  <WarehouseFilter
                    value={warehouseId}
                    onChange={setWarehouseId}
                    allowAll={false}
                    required
                  />
                </Field>
                <Field
                  label="Picking strategy"
                  hint="Blank uses each item's own setting"
                >
                  <SelectField
                    value={strategy}
                    onChange={event => setStrategy(event.target.value)}
                  >
                    <option value="">Per item default</option>
                    <option value="FIFO">FIFO — oldest receipt first</option>
                    <option value="LIFO">LIFO — newest receipt first</option>
                    <option value="FEFO">FEFO — earliest expiry first</option>
                  </SelectField>
                </Field>
                {source === "SALES_ORDER" && (
                  <Field label="Sales order">
                    <SelectField
                      required
                      value={salesOrderId}
                      onChange={event => setSalesOrderId(event.target.value)}
                    >
                      <option value="">Select an order…</option>
                      {(salesOrders ?? []).map(order => (
                        <option key={order.id} value={order.id}>
                          {order.orderNumber} — {order.account?.name}
                        </option>
                      ))}
                    </SelectField>
                  </Field>
                )}
              </div>

              {source === "MANUAL" && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Lines to pick
                  </p>
                  {lines.map((line, index) => (
                    <div
                      key={index}
                      className="grid gap-2 md:grid-cols-[3fr,1fr,auto]"
                    >
                      <ProductPicker
                        value={line.product}
                        onChange={product =>
                          setLines(current =>
                            current.map((entry, i) =>
                              i === index ? { ...entry, product } : entry
                            )
                          )
                        }
                      />
                      <Input
                        placeholder="Quantity"
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={event =>
                          setLines(current =>
                            current.map((entry, i) =>
                              i === index
                                ? { ...entry, quantity: event.target.value }
                                : entry
                            )
                          )
                        }
                      />
                      <button
                        type="button"
                        disabled={lines.length === 1}
                        onClick={() =>
                          setLines(current =>
                            current.filter((_, i) => i !== index)
                          )
                        }
                        className="rounded border px-3 text-sm hover:bg-muted disabled:opacity-40 whitespace-nowrap"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setLines(current => [
                        ...current,
                        { product: null, quantity: "" },
                      ])
                    }
                    className="rounded border px-3 py-1.5 text-sm hover:bg-muted whitespace-nowrap"
                  >
                    Add line
                  </button>
                </div>
              )}

              <Button type="submit" disabled={!canSubmit}>
                {createPickList.isPending
                  ? "Allocating stock…"
                  : "Create pick list"}
              </Button>
            </form>
          </Panel>
        )}

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
                <option value="DRAFT">Draft</option>
                <option value="RELEASED">Released</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="PICKED">Picked</option>
                <option value="PACKED">Packed</option>
                <option value="SHIPPED">Shipped</option>
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
            rows={pickLists}
            keyOf={row => row.id}
            onRowClick={row => router.push(`/warehouse/pick-lists/${row.id}`)}
            empty="No pick lists yet."
            columns={[
              {
                header: "Pick list",
                cell: row => (
                  <span className="font-mono text-xs text-primary">
                    {row.pickListNumber}
                  </span>
                ),
              },
              { header: "Warehouse", cell: row => row.warehouse.code },
              {
                header: "For",
                cell: row =>
                  row.referenceNumber ?? humanizeEnum(row.referenceType),
              },
              { header: "Strategy", cell: row => row.strategy },
              {
                header: "Tasks",
                align: "right",
                cell: row => row._count?.tasks ?? 0,
              },
              {
                header: "Packages",
                align: "right",
                cell: row => row._count?.packages ?? 0,
              },
              {
                header: "Status",
                cell: row => <StatusBadge status={row.status} />,
              },
              {
                header: "Assigned to",
                cell: row =>
                  row.assignedTo
                    ? `${row.assignedTo.firstName ?? ""} ${row.assignedTo.lastName ?? ""}`.trim()
                    : "—",
              },
              { header: "Created", cell: row => formatDateTime(row.createdAt) },
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
