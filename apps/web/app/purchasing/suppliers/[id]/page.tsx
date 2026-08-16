"use client";

import { useState } from "react";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import Link from "next/link";
import { Alert } from "@repo/ui/components/ui/alert";
import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  DetailRow,
  ErrorBanner,
  Field,
  PageHeader,
  Panel,
  SimpleTable,
  StatCard,
  StatusBadge,
  TabBar,
} from "@/components/supply-chain/shared";
import {
  ProductPicker,
  type PickedProduct,
} from "@/components/supply-chain/ProductPicker";
import {
  useSupplier,
  useSupplierCatalogue,
  useSupplierMutations,
  useSupplierPerformance,
} from "@/hooks/useSupplyChain";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatPercent,
  formatQuantity,
} from "@/lib/utils/decimal";

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const supplierId = Number(params.id);
  const [tab, setTab] = useState<
    "overview" | "catalogue" | "performance" | "contacts"
  >("overview");

  const { data, isLoading, error } = useSupplier(supplierId);
  const { entries, isLoading: catalogueLoading } = useSupplierCatalogue(
    supplierId,
    { limit: 100 }
  );
  const { data: performanceData, isLoading: performanceLoading } =
    useSupplierPerformance(supplierId);
  const {
    update,
    addContact,
    removeContact,
    savePrice,
    removePrice,
    snapshotPerformance,
  } = useSupplierMutations();

  const supplier = data?.data;
  const performance = performanceData?.data;
  const scorecard = performance?.scorecard;

  const [priceForm, setPriceForm] = useState<{
    product: PickedProduct | null;
    unitPrice: string;
    supplierSku: string;
    minOrderQuantity: string;
    leadTimeDays: string;
    isPreferred: boolean;
  }>({
    product: null,
    unitPrice: "",
    supplierSku: "",
    minOrderQuantity: "1",
    leadTimeDays: "0",
    isPreferred: false,
  });

  return (
    <ProtectedRoute>
      <div className="space-y-5 p-4">
        <PageHeader
          title={supplier ? `${supplier.code} — ${supplier.name}` : "Supplier"}
          subtitle={
            supplier
              ? [supplier.city, supplier.state, supplier.country]
                  .filter(Boolean)
                  .join(", ") || "No address on file"
              : undefined
          }
          breadcrumb={[
            { label: "Purchasing", href: "/purchasing" },
            { label: "Suppliers", href: "/purchasing/suppliers" },
            { label: supplier?.code ?? String(supplierId) },
          ]}
          actions={
            supplier && (
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={supplier.status} />
                {supplier.status !== "BLACKLISTED" && (
                  <Button
                    type="button"
                    onClick={() => {
                      const reason = window.prompt(
                        "Reason for blacklisting this supplier?"
                      );
                      if (reason) {
                        update.mutate({
                          id: supplierId,
                          payload: {
                            status: "BLACKLISTED",
                            isBlacklisted: true,
                            blacklistReason: reason,
                          },
                        });
                      }
                    }}
                    variant="outline"
                    className="px-3 text-red-700 hover:bg-red-50 whitespace-nowrap"
                  >
                    Blacklist
                  </Button>
                )}
                {supplier.status !== "ACTIVE" && (
                  <Button
                    type="button"
                    onClick={() =>
                      update.mutate({
                        id: supplierId,
                        payload: { status: "ACTIVE", isBlacklisted: false },
                      })
                    }
                    variant="outline"
                    className="px-3 whitespace-nowrap"
                  >
                    Activate
                  </Button>
                )}
              </div>
            )
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={update.error} />
        <ErrorBanner error={savePrice.error} />
        <ErrorBanner error={addContact.error} />

        {supplier?.isBlacklisted && supplier.blacklistReason && (
          <Alert tone="error" title="Supplier blacklisted">
            {supplier.blacklistReason}. Purchase orders cannot be raised against
            this supplier.
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Overall score"
            value={
              scorecard?.hasData
                ? formatQuantity(scorecard.overallScore, 1)
                : "Not rated"
            }
            hint={
              scorecard?.hasData
                ? "Last 12 months"
                : "No receipts in the period"
            }
            tone={
              !scorecard?.hasData
                ? "neutral"
                : Number(scorecard.overallScore) >= 85
                  ? "positive"
                  : Number(scorecard.overallScore) >= 70
                    ? "warning"
                    : "critical"
            }
          />
          <StatCard
            label="On-time delivery"
            value={
              scorecard?.hasData
                ? formatPercent(scorecard.onTimeDeliveryRate)
                : "—"
            }
            hint={
              scorecard
                ? `${scorecard.onTimeReceipts} on time, ${scorecard.lateReceipts} late`
                : undefined
            }
          />
          <StatCard
            label="Quality acceptance"
            value={
              scorecard?.hasData
                ? formatPercent(scorecard.qualityAcceptanceRate)
                : "—"
            }
            hint={
              scorecard
                ? `${formatQuantity(scorecard.rejectedQuantity)} rejected`
                : undefined
            }
          />
          <StatCard
            label="Orders"
            value={scorecard?.totalOrders ?? 0}
            hint={
              scorecard ? formatMoney(scorecard.totalOrderValue) : undefined
            }
          />
        </div>

        <TabBar
          label="Supplier sections"
          value={tab}
          onChange={setTab}
          items={[
            ["overview", "Overview"],
            ["catalogue", `Catalogue (${entries.length})`],
            ["performance", "Performance"],
            ["contacts", `Contacts (${supplier?.contacts?.length ?? 0})`],
          ]}
        />

        {tab === "overview" && supplier && (
          <>
            <Panel title="Supplier details">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DetailRow
                  label="Legal name"
                  value={supplier.legalName ?? "—"}
                />
                <DetailRow
                  label="GST number"
                  value={supplier.gstNumber ?? "—"}
                />
                <DetailRow label="PAN" value={supplier.panNumber ?? "—"} />
                <DetailRow label="Currency" value={supplier.currencyCode} />
                <DetailRow label="Email" value={supplier.email ?? "—"} />
                <DetailRow label="Phone" value={supplier.phone ?? "—"} />
                <DetailRow
                  label="Payment terms"
                  value={supplier.paymentTerms ?? "—"}
                />
                <DetailRow
                  label="Credit days"
                  value={`${supplier.creditDays}`}
                />
                <DetailRow
                  label="Lead time"
                  value={`${supplier.leadTimeDays} days`}
                />
                <DetailRow
                  label="Incoterms"
                  value={supplier.incoterms ?? "—"}
                />
                <DetailRow
                  label="Minimum order value"
                  value={
                    supplier.minOrderValue
                      ? formatMoney(supplier.minOrderValue)
                      : "—"
                  }
                />
                <DetailRow
                  label="Bank"
                  value={
                    supplier.bankName
                      ? `${supplier.bankName} · ${supplier.bankIfsc ?? ""}`
                      : "—"
                  }
                />
              </div>
            </Panel>

            <Panel title="Recent purchase orders">
              <SimpleTable
                rows={supplier.recentOrders ?? []}
                keyOf={row => row.id}
                empty="No purchase orders raised against this supplier yet."
                columns={[
                  {
                    header: "PO",
                    cell: row => (
                      <Link
                        href={`/purchasing/orders/${row.id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {row.poNumber}
                      </Link>
                    ),
                  },
                  { header: "Ordered", cell: row => formatDate(row.orderDate) },
                  {
                    header: "Expected",
                    cell: row => formatDate(row.expectedDeliveryDate),
                  },
                  {
                    header: "Status",
                    cell: row => <StatusBadge status={row.status} />,
                  },
                  {
                    header: "Value",
                    align: "right",
                    cell: row => formatMoney(row.grandTotal, row.currencyCode),
                  },
                ]}
              />
            </Panel>
          </>
        )}

        {tab === "catalogue" && (
          <>
            <Panel
              title="Add or supersede a price"
              description="Saving a new price closes the previous open price for that item, so the history of what was agreed and when stays intact."
            >
              <form
                className="grid gap-4 md:grid-cols-5"
                onSubmit={event => {
                  event.preventDefault();
                  if (!priceForm.product || !priceForm.unitPrice) return;
                  savePrice.mutate(
                    {
                      supplierId,
                      payload: {
                        productId: priceForm.product.id,
                        unitPrice: priceForm.unitPrice,
                        supplierSku: priceForm.supplierSku || undefined,
                        minOrderQuantity: priceForm.minOrderQuantity,
                        leadTimeDays: Number(priceForm.leadTimeDays) || 0,
                        isPreferred: priceForm.isPreferred,
                      },
                    },
                    {
                      onSuccess: () =>
                        setPriceForm({
                          product: null,
                          unitPrice: "",
                          supplierSku: "",
                          minOrderQuantity: "1",
                          leadTimeDays: "0",
                          isPreferred: false,
                        }),
                    }
                  );
                }}
              >
                <Field label="Item" className="md:col-span-2" composite>
                  <ProductPicker
                    value={priceForm.product}
                    onChange={product =>
                      setPriceForm({ ...priceForm, product })
                    }
                  />
                </Field>
                <Field label="Unit price">
                  <Input
                    required
                    inputMode="decimal"
                    value={priceForm.unitPrice}
                    onChange={e =>
                      setPriceForm({ ...priceForm, unitPrice: e.target.value })
                    }
                  />
                </Field>
                <Field label="Supplier SKU">
                  <Input
                    value={priceForm.supplierSku}
                    onChange={e =>
                      setPriceForm({
                        ...priceForm,
                        supplierSku: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Min order qty">
                  <Input
                    inputMode="decimal"
                    value={priceForm.minOrderQuantity}
                    onChange={e =>
                      setPriceForm({
                        ...priceForm,
                        minOrderQuantity: e.target.value,
                      })
                    }
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm md:col-span-3">
                  <Checkbox
                    checked={priceForm.isPreferred}
                    onCheckedChange={checked =>
                      setPriceForm({
                        ...priceForm,
                        isPreferred: checked,
                      })
                    }
                  />
                  Make this the preferred source for the item
                </label>
                <div className="md:col-span-2">
                  <Button
                    type="submit"
                    disabled={
                      !priceForm.product ||
                      !priceForm.unitPrice ||
                      savePrice.isPending
                    }
                    className="w-full"
                  >
                    {savePrice.isPending ? "Saving…" : "Save price"}
                  </Button>
                </div>
              </form>
            </Panel>

            <Panel
              title="Catalogue"
              description="Prices in force are used automatically when a purchase order line omits a price."
            >
              <SimpleTable
                isLoading={catalogueLoading}
                rows={entries}
                keyOf={row => row.id}
                empty="No prices on record. Purchase order lines for this supplier will require a price to be entered by hand until one is added."
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
                    header: "Supplier SKU",
                    cell: row => row.supplierSku ?? "—",
                  },
                  {
                    header: "Unit price",
                    align: "right",
                    cell: row => formatMoney(row.unitPrice, row.currencyCode),
                  },
                  {
                    header: "Min order",
                    align: "right",
                    cell: row => formatQuantity(row.minOrderQuantity),
                  },
                  {
                    header: "Pack size",
                    align: "right",
                    cell: row => formatQuantity(row.packSize),
                  },
                  {
                    header: "Lead time",
                    align: "right",
                    cell: row => `${row.leadTimeDays}d`,
                  },
                  {
                    header: "Valid from",
                    cell: row => formatDate(row.validFrom),
                  },
                  {
                    header: "Valid to",
                    cell: row =>
                      row.validTo ? formatDate(row.validTo) : "open",
                  },
                  {
                    header: "Break pricing",
                    cell: row =>
                      row.priceTiers.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {row.priceTiers
                            .map(
                              tier =>
                                `${formatQuantity(tier.minQuantity)}+ @ ${formatMoney(tier.unitPrice)}`
                            )
                            .join(", ")}
                        </span>
                      ),
                  },
                  {
                    header: "",
                    cell: row => (
                      <div className="flex items-center gap-2">
                        {row.isPreferred && (
                          <span className="text-xs font-medium text-emerald-700">
                            preferred
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Close this price for ${row.product.code}?`
                              )
                            )
                              removePrice.mutate(row.id);
                          }}
                          className="rounded border px-2 py-1 text-xs hover:bg-muted whitespace-nowrap"
                        >
                          Close
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            </Panel>
          </>
        )}

        {tab === "performance" && (
          <>
            <Panel
              title="Scorecard"
              description="Every figure is derived from posted purchase orders and goods receipts over the last 12 months."
              actions={
                <Button
                  type="button"
                  onClick={() => snapshotPerformance.mutate({ id: supplierId })}
                  disabled={snapshotPerformance.isPending}
                  variant="outline"
                  className="px-3 whitespace-nowrap"
                >
                  {snapshotPerformance.isPending
                    ? "Saving…"
                    : "Snapshot this period"}
                </Button>
              }
            >
              {performanceLoading ? (
                <div className="h-24 animate-pulse rounded bg-muted" />
              ) : !scorecard?.hasData ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  This supplier has no goods receipts in the period, so there is
                  nothing to score. An unrated supplier is not the same as a
                  poor one.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <DetailRow
                    label="Receipts"
                    value={`${scorecard.receiptsCount} (${scorecard.onTimeReceipts} on time)`}
                  />
                  <DetailRow
                    label="On-time delivery"
                    value={formatPercent(scorecard.onTimeDeliveryRate)}
                  />
                  <DetailRow
                    label="Quality acceptance"
                    value={formatPercent(scorecard.qualityAcceptanceRate)}
                  />
                  <DetailRow
                    label="Fill rate"
                    value={formatPercent(scorecard.fillRate)}
                  />
                  <DetailRow
                    label="Average lead time"
                    value={`${formatQuantity(scorecard.averageLeadTimeDays, 1)} days`}
                  />
                  <DetailRow
                    label="Price variance"
                    value={formatPercent(scorecard.priceVariancePercent, 2)}
                  />
                  <DetailRow
                    label="Received quantity"
                    value={formatQuantity(scorecard.receivedQuantity)}
                  />
                  <DetailRow
                    label="Rejected quantity"
                    value={formatQuantity(scorecard.rejectedQuantity)}
                  />
                </div>
              )}
            </Panel>

            <Panel
              title="Snapshot history"
              description="Saved period scorecards, newest first"
            >
              <SimpleTable
                rows={performance?.history ?? []}
                keyOf={row => row.id}
                empty="No snapshots saved yet. They are also created automatically each month."
                columns={[
                  {
                    header: "Period",
                    cell: row =>
                      `${formatDate(row.periodStart)} → ${formatDate(row.periodEnd)}`,
                  },
                  {
                    header: "Orders",
                    align: "right",
                    cell: row => row.totalOrders,
                  },
                  {
                    header: "Receipts",
                    align: "right",
                    cell: row => row.receiptsCount,
                  },
                  {
                    header: "On time",
                    align: "right",
                    cell: row => formatPercent(row.onTimeDeliveryRate),
                  },
                  {
                    header: "Quality",
                    align: "right",
                    cell: row => formatPercent(row.qualityAcceptanceRate),
                  },
                  {
                    header: "Fill rate",
                    align: "right",
                    cell: row => formatPercent(row.fillRate),
                  },
                  {
                    header: "Score",
                    align: "right",
                    cell: row => formatQuantity(row.overallScore, 1),
                  },
                  {
                    header: "Computed",
                    cell: row => formatDateTime(row.computedAt),
                  },
                ]}
              />
            </Panel>
          </>
        )}

        {tab === "contacts" && (
          <>
            <Panel title="Add a contact">
              <form
                className="grid gap-4 md:grid-cols-5"
                onSubmit={event => {
                  event.preventDefault();
                  const formData = new FormData(
                    event.currentTarget as HTMLFormElement
                  );
                  addContact.mutate({
                    supplierId,
                    payload: {
                      name: formData.get("name"),
                      designation: formData.get("designation"),
                      email: formData.get("email"),
                      phone: formData.get("phone"),
                      isPrimary: formData.get("isPrimary") === "on",
                    },
                  });
                  (event.currentTarget as HTMLFormElement).reset();
                }}
              >
                <Field label="Name">
                  <Input name="name" required />
                </Field>
                <Field label="Designation">
                  <Input name="designation" />
                </Field>
                <Field label="Email">
                  <Input name="email" type="email" />
                </Field>
                <Field label="Phone">
                  <Input name="phone" />
                </Field>
                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <Checkbox name="isPrimary" /> Primary
                  </label>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={addContact.isPending}
                    className="whitespace-nowrap px-3"
                  >
                    Add
                  </Button>
                </div>
              </form>
            </Panel>

            <Panel title="Contacts">
              <SimpleTable
                isLoading={isLoading}
                rows={supplier?.contacts ?? []}
                keyOf={row => row.id}
                empty="No contacts recorded."
                columns={[
                  { header: "Name", cell: row => row.name },
                  {
                    header: "Designation",
                    cell: row => row.designation ?? "—",
                  },
                  { header: "Email", cell: row => row.email ?? "—" },
                  { header: "Phone", cell: row => row.phone ?? "—" },
                  {
                    header: "Primary",
                    cell: row =>
                      row.isPrimary ? (
                        <span className="text-xs font-medium text-emerald-700">
                          Yes
                        </span>
                      ) : (
                        "—"
                      ),
                  },
                  {
                    header: "",
                    cell: row => (
                      <button
                        type="button"
                        onClick={() => removeContact.mutate(row.id)}
                        className="rounded border px-2 py-1 text-xs text-red-700 hover:bg-red-50 whitespace-nowrap"
                      >
                        Remove
                      </button>
                    ),
                  },
                ]}
              />
            </Panel>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
