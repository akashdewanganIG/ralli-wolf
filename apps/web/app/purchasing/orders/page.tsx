"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SearchFilterToolbar } from "@repo/ui/components/ui/toolbar";
import {
  ErrorBanner,
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
import {
  usePurchaseOrders,
  usePurchasingMutations,
  useSuppliers,
} from "@/hooks/useSupplyChain";
import { formatDate, formatMoney } from "@/lib/utils/decimal";

interface DraftLine {
  product: PickedProduct | null;
  quantity: string;
  unitPrice: string;
  taxPercent: string;
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [filterSupplierId, setFilterSupplierId] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [shippingAmount, setShippingAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { product: null, quantity: "", unitPrice: "", taxPercent: "18" },
  ]);

  const { orders, pagination, isLoading, error } = usePurchaseOrders({
    page,
    limit: 25,
    status: status || undefined,
    search: search || undefined,
    supplierId: filterSupplierId ? Number(filterSupplierId) : undefined,
  });
  const { suppliers } = useSuppliers({ limit: 200 });
  const { createOrder } = usePurchasingMutations();

  const validLines = lines.filter(
    line => line.product && Number(line.quantity) > 0
  );
  const canSubmit =
    !!supplierId &&
    !!warehouseId &&
    validLines.length > 0 &&
    !createOrder.isPending;

  const estimatedTotal = validLines.reduce(
    (acc, line) => {
      const net = Number(line.quantity) * Number(line.unitPrice || 0);
      return acc + net + (net * Number(line.taxPercent || 0)) / 100;
    },
    Number(shippingAmount) || 0
  );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!supplierId || !warehouseId) return;

    createOrder.mutate(
      {
        supplierId: Number(supplierId),
        warehouseId,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        shippingAmount,
        notes: notes || undefined,
        lines: validLines.map(line => ({
          productId: line.product!.id,
          quantity: line.quantity,
          // Blank price falls back to the supplier's catalogue price for the day.
          unitPrice: line.unitPrice || undefined,
          taxPercent: line.taxPercent || undefined,
        })),
      },
      {
        onSuccess: result => {
          setShowForm(false);
          setLines([
            { product: null, quantity: "", unitPrice: "", taxPercent: "18" },
          ]);
          router.push(
            `/purchasing/orders/${(result.data as { id: number }).id}`
          );
        },
      }
    );
  };

  return (
    <ProtectedRoute>
      <div className="space-y-5 p-4">
        <PageHeader
          title="Purchase orders"
          subtitle="Create, approve, and track supplier orders."
          actions={
            <Button
              type="button"
              onClick={() => setShowForm(current => !current)}
              className="px-3 whitespace-nowrap"
            >
              {showForm ? "Close" : "New purchase order"}
            </Button>
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={createOrder.error} />

        {showForm && (
          <Panel
            title="New purchase order"
            description="Created as a draft; submit it for approval before it can be sent to the supplier."
          >
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="Supplier">
                  <SelectField
                    required
                    value={supplierId}
                    onChange={event => setSupplierId(event.target.value)}
                  >
                    <option value="">Select a supplier…</option>
                    {suppliers
                      .filter(
                        supplier =>
                          !supplier.isBlacklisted &&
                          supplier.status !== "INACTIVE"
                      )
                      .map(supplier => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.code} — {supplier.name}
                        </option>
                      ))}
                  </SelectField>
                </Field>
                <Field label="Deliver to warehouse" composite>
                  <WarehouseFilter
                    value={warehouseId}
                    onChange={setWarehouseId}
                    allowAll={false}
                    required
                  />
                </Field>
                <Field
                  label="Expected delivery"
                  hint="Blank derives from the supplier's lead time"
                >
                  <Input
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={event =>
                      setExpectedDeliveryDate(event.target.value)
                    }
                  />
                </Field>
                <Field label="Shipping / freight">
                  <Input
                    inputMode="decimal"
                    value={shippingAmount}
                    onChange={event => setShippingAmount(event.target.value)}
                  />
                </Field>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Lines
                </p>
                {lines.map((line, index) => (
                  <div
                    key={index}
                    className="grid gap-2 md:grid-cols-[3fr,1fr,1fr,1fr,auto]"
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
                      placeholder="Search a purchasable item…"
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
                    <Input
                      placeholder="Price (auto)"
                      inputMode="decimal"
                      value={line.unitPrice}
                      onChange={event =>
                        setLines(current =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, unitPrice: event.target.value }
                              : entry
                          )
                        )
                      }
                    />
                    <Input
                      placeholder="Tax %"
                      inputMode="decimal"
                      value={line.taxPercent}
                      onChange={event =>
                        setLines(current =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, taxPercent: event.target.value }
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
                      {
                        product: null,
                        quantity: "",
                        unitPrice: "",
                        taxPercent: "18",
                      },
                    ])
                  }
                  className="rounded border px-3 py-1.5 text-sm hover:bg-muted whitespace-nowrap"
                >
                  Add line
                </button>
              </div>

              <Field label="Notes to supplier">
                <Input
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                />
              </Field>

              <div className="flex items-center gap-4">
                <Button type="submit" disabled={!canSubmit}>
                  {createOrder.isPending ? "Creating…" : "Create draft order"}
                </Button>
                {validLines.some(line => line.unitPrice) && (
                  <span className="text-sm text-muted-foreground">
                    Estimated total (entered prices only):{" "}
                    <strong>{formatMoney(estimatedTotal)}</strong>
                  </span>
                )}
              </div>
            </form>
          </Panel>
        )}

        <Panel
          actions={
            <SearchFilterToolbar
              search={
                <Input
                  placeholder="Search PO number or supplier"
                  value={search}
                  onChange={event => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              }
              filters={
                <>
                  <SelectField
                    aria-label="Filter by status"
                    className="w-full md:w-44"
                    value={status}
                    onChange={event => {
                      setStatus(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All statuses</option>
                    {[
                      "DRAFT",
                      "PENDING_APPROVAL",
                      "APPROVED",
                      "SENT",
                      "ACKNOWLEDGED",
                      "PARTIALLY_RECEIVED",
                      "RECEIVED",
                      "CLOSED",
                      "REJECTED",
                      "CANCELLED",
                    ].map(value => (
                      <option key={value} value={value}>
                        {value
                          .replace(/_/g, " ")
                          .toLowerCase()
                          .replace(/^\w/, c => c.toUpperCase())}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    aria-label="Filter by supplier"
                    className="w-full md:w-48"
                    value={filterSupplierId}
                    onChange={event => {
                      setFilterSupplierId(event.target.value);
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
                </>
              }
            />
          }
        >
          <SimpleTable
            isLoading={isLoading}
            rows={orders}
            keyOf={row => row.id}
            onRowClick={row => router.push(`/purchasing/orders/${row.id}`)}
            empty="No purchase orders yet."
            columns={[
              {
                header: "PO",
                cell: row => (
                  <span className="font-mono text-xs text-primary">
                    {row.poNumber}
                  </span>
                ),
              },
              { header: "Supplier", cell: row => row.supplier.name },
              { header: "Deliver to", cell: row => row.warehouse.code },
              { header: "Ordered", cell: row => formatDate(row.orderDate) },
              {
                header: "Expected",
                cell: row =>
                  formatDate(row.promisedDate ?? row.expectedDeliveryDate),
              },
              {
                header: "Lines",
                align: "right",
                cell: row => row._count?.lines ?? 0,
              },
              {
                header: "Receipts",
                align: "right",
                cell: row => row._count?.receipts ?? 0,
              },
              {
                header: "Total",
                align: "right",
                cell: row => formatMoney(row.grandTotal, row.currencyCode),
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
            totalItems={pagination?.totalItems}
            onChange={setPage}
          />
        </Panel>
      </div>
    </ProtectedRoute>
  );
}
