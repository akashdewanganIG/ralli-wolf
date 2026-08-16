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
  TabsList,
  TabsTrigger,
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
  Loader2,
  Mail,
  MapPin,
  Phone,
  StickyNote,
  TrendingUp,
  Truck,
  User,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import * as React from "react";

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
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

const STATUS_BADGE_CLASSES: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-800 border-amber-200",
  ACTIVATED: "bg-blue-100 text-blue-800 border-blue-200",
  DELIVERED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
  INVOICED: "bg-purple-100 text-purple-800 border-purple-200",
  SHIPPED: "bg-sky-100 text-sky-800 border-sky-200",
};

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
      <div className="space-y-5 p-4">
        <div className="text-lg font-semibold">Order not found</div>
        <Button variant="outline" onClick={() => router.push("/sales/orders")}>
          Back to Orders
        </Button>
      </div>
    );
  }

  const order = response.data;
  const statusBadgeClass =
    STATUS_BADGE_CLASSES[order.status] ??
    "bg-gray-100 text-gray-800 border-gray-200";

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
    <div className="p-4 space-y-6">
      <DetailPageHeader
        title={order.name}
        status={order.status}
        statusVariant="secondary"
        onBack={() => router.push("/sales/orders")}
        headerRight={
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownloadPdf(order.id, order.orderNumber)}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {isDownloading ? "Generating..." : "Download PDF"}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={v => setTab(v)}>
        <TabsList className="justify-start space-x-16 border-b border-gray-300">
          <TabsTrigger
            value="details"
            className="text-lg font-medium data-[state=active]:border-b-[3px] data-[state=active]:border-gray-700"
          >
            Details
          </TabsTrigger>
          <TabsTrigger
            value="products"
            className="text-lg font-medium data-[state=active]:border-b-[3px] data-[state=active]:border-gray-700"
          >
            Products
          </TabsTrigger>
        </TabsList>

        <TabsContents className="mt-8">
          {/* ── Details Tab ─────────────────────────────────────────────── */}
          <TabsContent value="details">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left column — main info */}
              <div className="lg:col-span-2 space-y-4">
                {/* Order Information */}
                <DetailCard
                  title="Order Information"
                  className="bg-white border-gray-200"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                        <Hash className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Order Number
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {order.orderNumber}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Status
                        </p>
                        <Badge className={statusBadgeClass}>
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-50">
                        <Calendar className="h-3.5 w-3.5 text-violet-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Order Date
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {formatDate(order.orderDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-purple-50">
                        <FileText className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Quote Number
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {order.quote?.quoteNumber ?? "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 sm:col-span-2">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange-50">
                        <TrendingUp className="h-3.5 w-3.5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Opportunity
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {order.quote?.opportunity?.name ?? "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </DetailCard>

                {/* Financial Summary */}
                <DetailCard
                  title="Financial Summary"
                  className="bg-white border-gray-200"
                >
                  <div className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 p-4 text-white mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-75">
                      Grand Total
                    </p>
                    <p className="mt-1 text-3xl font-bold">
                      ₹{formatCurrency(order.grandTotal)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm opacity-90">
                      <div>
                        <p className="text-xs opacity-75 uppercase tracking-wider">
                          Subtotal
                        </p>
                        <p className="font-semibold">
                          ₹{formatCurrency(order.subtotal)}
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
                          ₹{formatCurrency(order.shippingAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                </DetailCard>

                {/* Customer */}
                <DetailCard
                  title="Customer"
                  className="bg-white border-gray-200"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                        <Building2 className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Account
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {order.account.name}
                        </p>
                      </div>
                    </div>
                    {order.contact && (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-50">
                            <User className="h-3.5 w-3.5 text-violet-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Contact Name
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {order.contact.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-50">
                            <Mail className="h-3.5 w-3.5 text-sky-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Contact Email
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {order.contact.email ?? "—"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-green-50">
                            <Phone className="h-3.5 w-3.5 text-green-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Contact Phone
                            </p>
                            <p className="text-sm font-medium text-gray-700">
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
                        className="bg-white border-gray-200"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                              <CreditCard className="h-3.5 w-3.5 text-blue-500" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                                Name
                              </p>
                              <p className="text-sm font-medium text-gray-700">
                                {order.billingName}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-50">
                              <MapPin className="h-3.5 w-3.5 text-violet-500" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                                Address
                              </p>
                              <p className="text-sm font-medium text-gray-700">
                                {order.billingStreet ?? "—"}
                              </p>
                              {billingCityLine && (
                                <p className="text-sm text-gray-500">
                                  {billingCityLine}
                                </p>
                              )}
                              {order.billingCountry && (
                                <p className="text-sm text-gray-500">
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
                        className="bg-white border-gray-200"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-50">
                              <Truck className="h-3.5 w-3.5 text-sky-500" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                                Name
                              </p>
                              <p className="text-sm font-medium text-gray-700">
                                {order.shippingName}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-50">
                              <MapPin className="h-3.5 w-3.5 text-violet-500" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                                Address
                              </p>
                              <p className="text-sm font-medium text-gray-700">
                                {order.shippingStreet ?? "—"}
                              </p>
                              {shippingCityLine && (
                                <p className="text-sm text-gray-500">
                                  {shippingCityLine}
                                </p>
                              )}
                              {order.shippingCountry && (
                                <p className="text-sm text-gray-500">
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
                    className="bg-white border-gray-200"
                  >
                    <div className="space-y-3">
                      {order.paymentTerms && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50">
                            <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Payment Terms
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {order.paymentTerms}
                            </p>
                          </div>
                        </div>
                      )}
                      {order.deliveryTerms && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-50">
                            <Truck className="h-3.5 w-3.5 text-sky-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Delivery Terms
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {order.deliveryTerms}
                            </p>
                          </div>
                        </div>
                      )}
                      {order.notes && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100">
                            <StickyNote className="h-3.5 w-3.5 text-gray-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Notes
                            </p>
                            <p className="text-sm font-medium text-gray-700 whitespace-pre-wrap">
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
                <DetailCard title="Owner" className="bg-white border-gray-200">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-50">
                        <User className="h-3.5 w-3.5 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Owner Name
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {buildFullName(
                            order.owner.firstName,
                            order.owner.lastName
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-50">
                        <Mail className="h-3.5 w-3.5 text-sky-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Owner Email
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {order.owner.email ?? "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </DetailCard>

                <DetailCard
                  title="System Information"
                  className="bg-white border-gray-200"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                        <Clock className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Created At
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-purple-50">
                        <Clock className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Last Modified
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {formatDate(order.updatedAt)}
                        </p>
                      </div>
                    </div>
                    {order.approvedBy && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-green-50">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                            Approved By
                          </p>
                          <p className="text-sm font-medium text-gray-700">
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
