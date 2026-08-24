"use client";

import type { TableColumn } from "@/components/data-table";
import { DataTable } from "@/components/data-table";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { DetailPageSkeleton } from "@/components/skeletons";
import { useSalesOrderDetail } from "@/hooks/useSalesOrders";
import { salesOrderService } from "@/lib/api/services";
import type { SalesOrderLineItem } from "@/lib/api/types";
import { toast } from "@/lib/toast";
import {
  Badge,
  Button,
  DetailCard,
  DetailPageHeader,
  Tabs,
  TabsContent,
  TabsContents,
} from "@repo/ui";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileText,
  Hash,
  Mail,
  MapPin,
  Phone,
  StickyNote,
  TrendingUp,
  Truck,
  User,
} from "@repo/ui/icons";
import { useParams, useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import * as React from "react";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { statusTone } from "@repo/ui/components/ui/status-badge";
import { Tag } from "@repo/ui/components/ui/tag";
import { formatMoney } from "@/lib/utils/decimal";
import { CategorySwitcher } from "@repo/ui/components/ui/category-switcher";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(val: number | string | null | undefined) {
  if (val == null) return "N/A";
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return formatMoney(n);
}

function formatPercent(val: number | string | null | undefined) {
  if (val == null) return "N/A";
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return `${n.toFixed(2)}%`;
}

function buildFullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
) {
  return [firstName, lastName].filter(Boolean).join(" ") || "N/A";
}

const lineItemColumns: TableColumn<SalesOrderLineItem>[] = [
  {
    key: "product",
    label: "Product Name",
    render: (_, item) => item.product?.name ?? "—",
  },
  {
    key: "productCode",
    label: "Product Code",
    render: (_, item) => item.product?.code ?? "—",
  },
  { key: "quantity", label: "Quantity" },
  {
    key: "listPrice",
    label: "List Price",
    render: val => (val != null ? formatCurrency(val) : "—"),
  },
  {
    key: "discount",
    label: "Discount (%)",
    render: val => (val != null ? `${Number(val).toFixed(2)}%` : "—"),
  },
  {
    key: "unitPrice",
    label: "Unit Price",
    render: val => (val != null ? formatCurrency(val) : "—"),
  },
  {
    key: "totalPrice",
    label: "Total Price",
    render: val => (val != null ? formatCurrency(val) : "—"),
  },
];

function OrderDetailContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ? parseInt(params.id, 10) : 0;

  const { data: response, isLoading, isError } = useSalesOrderDetail(id);
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("details")
  );
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleDownloadPdf = React.useCallback(
    async (orderId: number, orderNumber: string) => {
      setIsDownloading(true);
      try {
        await salesOrderService.downloadPdf(orderId, orderNumber);
        toast.success("Order PDF downloaded");
      } catch (error) {
        toast.error(error, "Unable to download order PDF");
      } finally {
        setIsDownloading(false);
      }
    },
    []
  );

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (isError || !response?.data) {
    return (
      <PageShell>
        <div className="text-lg font-semibold">Order not found</div>
        <Button variant="outline" onClick={() => router.push("/sales/orders")}>
          Back to Orders
        </Button>
      </PageShell>
    );
  }

  const order = response.data;

  const billingCityLine = [
    order.billingCity,
    order.billingState,
    order.billingPostalCode,
  ]
    .filter(Boolean)
    .join(", ");

  const shippingCityLine = [
    order.shippingCity,
    order.shippingState,
    order.shippingPostalCode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="p-4 space-y-4">
      <DetailPageHeader
        title={order.name}
        status={order.status}
        statusTone={statusTone(order.status)}
        onBack={() => router.push("/sales/orders")}
        headerRight={
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownloadPdf(order.id, order.orderNumber)}
            disabled={isDownloading}
          >
            {isDownloading ? null : <Download className="h-4 w-4" />}
            {isDownloading ? "Generating..." : "Download PDF"}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={v => setTab(v)}>
        <CategorySwitcher
          label="Order sections"
          items={[
            { value: "details", label: "Details" },
            { value: "products", label: "Products" },
          ]}
        />

        <TabsContents>
          {/* ── Details Tab ─────────────────────────────────────────────── */}
          <TabsContent value="details">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left column — main info */}
              <div className="lg:col-span-2 space-y-4">
                {/* Order Information */}
                <DetailCard
                  title="Order Information"
                  className="bg-surface border-border"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-info-surface">
                        <Hash className="h-3.5 w-3.5 text-info" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Order Number
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {order.orderNumber}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-success-surface">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Status
                        </p>
                        <Tag tone={statusTone(order.status)}>
                          {order.status}
                        </Tag>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Order Date
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {formatDate(order.orderDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Quote Number
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {order.quote?.quoteNumber ?? "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 sm:col-span-2">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-warning-surface">
                        <TrendingUp className="h-3.5 w-3.5 text-warning" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Opportunity
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {order.quote?.opportunity?.name ?? "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </DetailCard>

                {/* Financial Summary */}
                <DetailCard
                  title="Financial Summary"
                  className="bg-surface border-border"
                >
                  <div className="rounded-xl bg-success-surface border border-success-border p-4 text-success-foreground mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-75">
                      Grand Total
                    </p>
                    <p className="mt-1 text-3xl font-bold">
                      {formatCurrency(order.grandTotal)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm opacity-90">
                      <div>
                        <p className="text-xs opacity-75 uppercase tracking-wider">
                          Subtotal
                        </p>
                        <p className="font-semibold">
                          {formatCurrency(order.subtotal)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs opacity-75 uppercase tracking-wider">
                          Discount
                        </p>
                        <p className="font-semibold">
                          {formatPercent(order.discountPercent)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs opacity-75 uppercase tracking-wider">
                          Tax
                        </p>
                        <p className="font-semibold">
                          {formatPercent(order.taxPercent)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs opacity-75 uppercase tracking-wider">
                          Shipping
                        </p>
                        <p className="font-semibold">
                          {formatCurrency(order.shippingAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                </DetailCard>

                {/* Customer */}
                <DetailCard
                  title="Customer"
                  className="bg-surface border-border"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-info-surface">
                        <Building2 className="h-3.5 w-3.5 text-info" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Account
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {order.account.name}
                        </p>
                      </div>
                    </div>
                    {order.contact && (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Contact Name
                            </p>
                            <p className="text-sm font-medium text-text-secondary">
                              {order.contact.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Contact Email
                            </p>
                            <p className="text-sm font-medium text-text-secondary">
                              {order.contact.email ?? "—"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-success-surface">
                            <Phone className="h-3.5 w-3.5 text-success" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Contact Phone
                            </p>
                            <p className="text-sm font-medium text-text-secondary">
                              {order.contact.phone ?? "—"}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </DetailCard>

                {/* Billing & Shipping Addresses */}
                {(order.billingName || order.shippingName) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {order.billingName && (
                      <DetailCard
                        title="Billing Address"
                        className="bg-surface border-border"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-info-surface">
                              <CreditCard className="h-3.5 w-3.5 text-info" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                                Name
                              </p>
                              <p className="text-sm font-medium text-text-secondary">
                                {order.billingName}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                                Address
                              </p>
                              <p className="text-sm font-medium text-text-secondary">
                                {order.billingStreet ?? "—"}
                              </p>
                              {billingCityLine && (
                                <p className="text-sm text-muted-foreground">
                                  {billingCityLine}
                                </p>
                              )}
                              {order.billingCountry && (
                                <p className="text-sm text-muted-foreground">
                                  {order.billingCountry}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </DetailCard>
                    )}
                    {order.shippingName && (
                      <DetailCard
                        title="Shipping Address"
                        className="bg-surface border-border"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                                Name
                              </p>
                              <p className="text-sm font-medium text-text-secondary">
                                {order.shippingName}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                                Address
                              </p>
                              <p className="text-sm font-medium text-text-secondary">
                                {order.shippingStreet ?? "—"}
                              </p>
                              {shippingCityLine && (
                                <p className="text-sm text-muted-foreground">
                                  {shippingCityLine}
                                </p>
                              )}
                              {order.shippingCountry && (
                                <p className="text-sm text-muted-foreground">
                                  {order.shippingCountry}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </DetailCard>
                    )}
                  </div>
                )}

                {/* Terms & Notes */}
                {(order.paymentTerms || order.deliveryTerms || order.notes) && (
                  <DetailCard
                    title="Terms & Notes"
                    className="bg-surface border-border"
                  >
                    <div className="space-y-3">
                      {order.paymentTerms && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-warning-surface">
                            <CreditCard className="h-3.5 w-3.5 text-warning" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Payment Terms
                            </p>
                            <p className="text-sm font-medium text-text-secondary">
                              {order.paymentTerms}
                            </p>
                          </div>
                        </div>
                      )}
                      {order.deliveryTerms && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Delivery Terms
                            </p>
                            <p className="text-sm font-medium text-text-secondary">
                              {order.deliveryTerms}
                            </p>
                          </div>
                        </div>
                      )}
                      {order.notes && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                            <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Notes
                            </p>
                            <p className="text-sm font-medium text-text-secondary whitespace-pre-wrap">
                              {order.notes}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </DetailCard>
                )}
              </div>

              {/* Right column — owner / system info */}
              <div className="space-y-4">
                <DetailCard title="Owner" className="bg-surface border-border">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-surface">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Owner Name
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {buildFullName(
                            order.owner.firstName,
                            order.owner.lastName
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Owner Email
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {order.owner.email ?? "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </DetailCard>

                <DetailCard
                  title="System Information"
                  className="bg-surface border-border"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-info-surface">
                        <Clock className="h-3.5 w-3.5 text-info" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Created At
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Last Modified
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {formatDate(order.updatedAt)}
                        </p>
                      </div>
                    </div>
                    {order.approvedBy && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-success-surface">
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                            Approved By
                          </p>
                          <p className="text-sm font-medium text-text-secondary">
                            {buildFullName(
                              order.approvedBy.firstName,
                              order.approvedBy.lastName
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </DetailCard>
              </div>
            </div>
          </TabsContent>

          {/* ── Products Tab ─────────────────────────────────────────────── */}
          <TabsContent value="products">
            <DataTable<SalesOrderLineItem>
              data={order.lineItems}
              columns={lineItemColumns}
              title="Product Line Items"
              count={order.lineItems.length}
              columnPreferenceKey="sales-order-line-items"
            />
          </TabsContent>
        </TabsContents>
      </Tabs>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <RoleGuard allowedRoles={["ADMIN", "ADMIN", "SALES"]}>
      <NuqsAdapter>
        <OrderDetailContent />
      </NuqsAdapter>
    </RoleGuard>
  );
}
