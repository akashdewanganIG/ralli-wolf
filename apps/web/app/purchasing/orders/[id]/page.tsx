"use client";

import { useState } from "react";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  DetailRow,
  ErrorBanner,
  Field,
  PageHeader,
  Panel,
  SelectField,
  SimpleTable,
  StatCard,
  StatusBadge,
} from "@/components/supply-chain/shared";
import {
  usePurchaseOrder,
  usePurchasingMutations,
  useGoodsReceiptMutations,
} from "@/hooks/useSupplyChain";
import { useUsersWithPagination } from "@/hooks/useUsers";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatPercent,
  formatQuantity,
} from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { buttonVariants } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = Number(params.id);

  const { data, isLoading, error } = usePurchaseOrder(orderId);
  const { submitForApproval, setOrderStatus } = usePurchasingMutations();
  const { create: createReceipt } = useGoodsReceiptMutations();
  // Only ADMIN  can approve a purchase order, matching the
  // rule the API enforces.
  const usersQuery = useUsersWithPagination({ limit: 200 });

  const [approverId, setApproverId] = useState("");
  const [showReceive, setShowReceive] = useState(false);
  const [receiptDraft, setReceiptDraft] = useState<Record<number, string>>({});
  const [receiptMeta, setReceiptMeta] = useState({
    supplierInvoiceNumber: "",
    vehicleNumber: "",
    requiresQc: false,
  });

  const order = data?.data;
  const lines = order?.lines ?? [];
  const receipts = order?.receipts ?? [];
  const approvals = order?.approvals ?? [];

  const approvers = (usersQuery.data ?? []).filter(
    user => user.role === "ADMIN"
  );

  const receiptLines = Object.entries(receiptDraft)
    .filter(([, value]) => value !== "" && Number(value) > 0)
    .map(([lineId, quantity]) => {
      const line = lines.find(entry => entry.id === Number(lineId));
      return {
        purchaseOrderLineId: Number(lineId),
        productId: line?.productId ?? 0,
        receivedQuantity: quantity,
      };
    })
    .filter(line => line.productId > 0);

  const totalOrdered = lines.reduce(
    (acc, line) => acc + Number(line.quantity),
    0
  );
  const totalReceived = lines.reduce(
    (acc, line) => acc + Number(line.receivedQuantity),
    0
  );

  const canEdit = order?.status === "DRAFT" || order?.status === "REJECTED";
  const canReceive =
    order &&
    ["APPROVED", "SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"].includes(
      order.status
    ) &&
    totalReceived < totalOrdered;

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title={order ? `Purchase order ${order.poNumber}` : "Purchase order"}
          subtitle={
            order
              ? `${order.supplier.name} · deliver to ${order.warehouse.code} · ordered ${formatDate(order.orderDate)}`
              : undefined
          }
          breadcrumb={[
            { label: "Purchasing", href: "/purchasing" },
            { label: "Orders", href: "/purchasing/orders" },
            { label: order?.poNumber ?? String(orderId) },
          ]}
          actions={
            order && (
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={order.status} />
                {order.status === "APPROVED" && (
                  <Button
                    type="button"
                    onClick={() =>
                      setOrderStatus.mutate({ id: orderId, status: "SENT" })
                    }
                    disabled={setOrderStatus.isPending}
                    className="px-3 whitespace-nowrap"
                  >
                    Mark as sent
                  </Button>
                )}
                {order.status === "SENT" && (
                  <Button
                    type="button"
                    onClick={() =>
                      setOrderStatus.mutate({
                        id: orderId,
                        status: "ACKNOWLEDGED",
                      })
                    }
                    disabled={setOrderStatus.isPending}
                    variant="outline"
                    className="px-3 whitespace-nowrap"
                  >
                    Supplier acknowledged
                  </Button>
                )}
                {canReceive && (
                  <Button
                    type="button"
                    onClick={() => setShowReceive(current => !current)}
                    className="px-3 whitespace-nowrap"
                  >
                    {showReceive ? "Close receipt" : "Receive goods"}
                  </Button>
                )}
                {(order.status === "RECEIVED" ||
                  order.status === "PARTIALLY_RECEIVED") && (
                  <Button
                    type="button"
                    onClick={() =>
                      setOrderStatus.mutate({ id: orderId, status: "CLOSED" })
                    }
                    disabled={setOrderStatus.isPending}
                    variant="outline"
                    className="px-3 whitespace-nowrap"
                  >
                    Close order
                  </Button>
                )}
                {canEdit && (
                  <Button
                    type="button"
                    onClick={() => {
                      const reason =
                        window.prompt("Reason for cancelling this order?") ??
                        undefined;
                      setOrderStatus.mutate({
                        id: orderId,
                        status: "CANCELLED",
                        reason,
                      });
                    }}
                    disabled={setOrderStatus.isPending}
                    variant="outline"
                    className="px-3 text-error-foreground hover:bg-error-surface whitespace-nowrap"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={submitForApproval.error} />
        <ErrorBanner error={setOrderStatus.error} />
        <ErrorBanner error={createReceipt.error} />

        <div className="grid-auto-fit gap-3">
          <StatCard
            label="Order value"
            value={
              order ? formatMoney(order.grandTotal, order.currencyCode) : "—"
            }
          />
          <StatCard label="Lines" value={lines.length} />
          <StatCard
            label="Received"
            value={`${formatQuantity(totalReceived)} / ${formatQuantity(totalOrdered)}`}
            tone={
              totalReceived >= totalOrdered && totalOrdered > 0
                ? "positive"
                : totalReceived > 0
                  ? "info"
                  : "neutral"
            }
          />
          <StatCard
            label="Goods receipts"
            value={receipts.length}
            href="/purchasing/goods-receipts"
          />
        </div>

        {canEdit && (
          <Panel
            title="Submit for approval"
            description="Purchase approvals use the same approval queue and notifications as sales."
          >
            <form
              className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap"
              onSubmit={event => {
                event.preventDefault();
                if (!approverId) return;
                submitForApproval.mutate({
                  id: orderId,
                  payload: { requestedToId: Number(approverId) },
                });
              }}
            >
              <Field label="Send to" className="w-full sm:w-72">
                <SelectField
                  required
                  value={approverId}
                  onChange={event => setApproverId(event.target.value)}
                >
                  <option value="">Choose an approver…</option>
                  {approvers.map(user => (
                    <option key={user.id} value={user.id}>
                      {`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
                        user.email}
                    </option>
                  ))}
                </SelectField>
              </Field>
              <button
                type="submit"
                disabled={
                  !approverId ||
                  submitForApproval.isPending ||
                  lines.length === 0
                }
                data-slot="button"
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "w-full sm:w-auto"
                )}
              >
                {submitForApproval.isPending
                  ? "Submitting…"
                  : "Submit for approval"}
              </button>
            </form>
          </Panel>
        )}

        {showReceive && canReceive && (
          <Panel
            title="Record a goods receipt"
            description="Enter what physically arrived per line. The receipt is created but not posted — post it once quantities and QC are confirmed."
          >
            <form
              className="space-y-4"
              onSubmit={event => {
                event.preventDefault();
                if (receiptLines.length === 0 || !order) return;
                createReceipt.mutate(
                  {
                    purchaseOrderId: orderId,
                    supplierInvoiceNumber:
                      receiptMeta.supplierInvoiceNumber || undefined,
                    vehicleNumber: receiptMeta.vehicleNumber || undefined,
                    requiresQc: receiptMeta.requiresQc,
                    lines: receiptLines,
                  } as never,
                  {
                    onSuccess: result => {
                      setShowReceive(false);
                      setReceiptDraft({});
                      router.push(
                        `/purchasing/goods-receipts/${(result.data as { id: number }).id}`
                      );
                    },
                  }
                );
              }}
            >
              <SimpleTable
                rows={lines.filter(
                  line => Number(line.receivedQuantity) < Number(line.quantity)
                )}
                keyOf={row => row.id}
                empty="Everything on this order has already been received."
                columns={[
                  {
                    header: "Item",
                    cell: row => `${row.product.code} — ${row.product.name}`,
                  },
                  {
                    header: "Ordered",
                    align: "right",
                    cell: row => formatQuantity(row.quantity),
                  },
                  {
                    header: "Already received",
                    align: "right",
                    cell: row => formatQuantity(row.receivedQuantity),
                  },
                  {
                    header: "Outstanding",
                    align: "right",
                    cell: row =>
                      formatQuantity(
                        Number(row.quantity) - Number(row.receivedQuantity)
                      ),
                  },
                  {
                    header: "Receiving now",
                    align: "right",
                    cell: row => (
                      <Input
                        className="w-28 text-right"
                        inputMode="decimal"
                        placeholder="0"
                        value={receiptDraft[row.id] ?? ""}
                        onChange={event =>
                          setReceiptDraft(current => ({
                            ...current,
                            [row.id]: event.target.value,
                          }))
                        }
                      />
                    ),
                  },
                ]}
              />
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="Supplier invoice number">
                  <Input
                    value={receiptMeta.supplierInvoiceNumber}
                    onChange={e =>
                      setReceiptMeta({
                        ...receiptMeta,
                        supplierInvoiceNumber: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Vehicle number">
                  <Input
                    value={receiptMeta.vehicleNumber}
                    onChange={e =>
                      setReceiptMeta({
                        ...receiptMeta,
                        vehicleNumber: e.target.value,
                      })
                    }
                  />
                </Field>
                <label className="flex items-center gap-2 pt-4 text-sm">
                  <Checkbox
                    checked={receiptMeta.requiresQc}
                    onCheckedChange={checked =>
                      setReceiptMeta({
                        ...receiptMeta,
                        requiresQc: checked,
                      })
                    }
                  />
                  Hold for quality inspection
                </label>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    disabled={
                      receiptLines.length === 0 || createReceipt.isPending
                    }
                    className="w-full"
                  >
                    {createReceipt.isPending
                      ? "Creating…"
                      : "Create goods receipt"}
                  </Button>
                </div>
              </div>
            </form>
          </Panel>
        )}

        {order && (
          <Panel title="Order details">
            <div className="grid-auto-fit gap-4">
              <DetailRow
                label="Supplier"
                value={
                  <Link
                    href={`/purchasing/suppliers/${order.supplierId}`}
                    className="text-primary hover:text-info"
                  >
                    {order.supplier.code} — {order.supplier.name}
                  </Link>
                }
              />
              <DetailRow
                label="Deliver to"
                value={`${order.warehouse.code} — ${order.warehouse.name}`}
              />
              <DetailRow
                label="Order date"
                value={formatDate(order.orderDate)}
              />
              <DetailRow
                label="Expected delivery"
                value={formatDate(order.expectedDeliveryDate)}
              />
              <DetailRow
                label="Promised date"
                value={formatDate(order.promisedDate)}
              />
              <DetailRow
                label="Payment terms"
                value={order.paymentTerms ?? "—"}
              />
              <DetailRow label="Incoterms" value={order.incoterms ?? "—"} />
              <DetailRow label="Currency" value={order.currencyCode} />
              <DetailRow
                label="Created by"
                value={
                  `${order.createdBy.firstName ?? ""} ${order.createdBy.lastName ?? ""}`.trim() ||
                  "—"
                }
              />
              <DetailRow
                label="Approved by"
                value={
                  order.approvedBy
                    ? `${order.approvedBy.firstName ?? ""} ${order.approvedBy.lastName ?? ""}`.trim()
                    : "—"
                }
              />
              <DetailRow label="Sent at" value={formatDateTime(order.sentAt)} />
              <DetailRow
                label="From requisition"
                value={
                  order.requisition ? (
                    <Link
                      href={`/purchasing/requisitions/${order.requisition.id}`}
                      className="text-primary hover:text-info"
                    >
                      {order.requisition.requisitionNumber}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              {order.notes && <DetailRow label="Notes" value={order.notes} />}
              {order.cancellationReason && (
                <DetailRow
                  label="Cancellation reason"
                  value={order.cancellationReason}
                />
              )}
            </div>
          </Panel>
        )}

        <Panel title="Lines">
          <SimpleTable
            isLoading={isLoading}
            rows={lines}
            keyOf={row => row.id}
            empty="This order has no lines."
            columns={[
              { header: "#", align: "right", cell: row => row.lineNumber },
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
                header: "Ordered",
                align: "right",
                cell: row =>
                  `${formatQuantity(row.quantity)} ${row.uom?.code ?? ""}`,
              },
              {
                header: "Unit price",
                align: "right",
                cell: row => formatMoney(row.unitPrice, order?.currencyCode),
              },
              {
                header: "Discount",
                align: "right",
                cell: row => formatPercent(row.discountPercent),
              },
              {
                header: "Tax",
                align: "right",
                cell: row => formatPercent(row.taxPercent),
              },
              {
                header: "Line total",
                align: "right",
                cell: row => formatMoney(row.lineTotal, order?.currencyCode),
              },
              {
                header: "Received",
                align: "right",
                cell: row => formatQuantity(row.receivedQuantity),
              },
              {
                header: "Accepted",
                align: "right",
                cell: row => formatQuantity(row.acceptedQuantity),
              },
              {
                header: "Rejected",
                align: "right",
                cell: row =>
                  Number(row.rejectedQuantity) > 0 ? (
                    <span className="font-semibold text-error-foreground">
                      {formatQuantity(row.rejectedQuantity)}
                    </span>
                  ) : (
                    "—"
                  ),
              },
              {
                header: "Status",
                cell: row => <StatusBadge status={row.status} />,
              },
            ]}
          />
          {order && (
            <div className="mt-3 flex flex-wrap justify-end gap-4 border-t pt-3 text-sm">
              <span>
                Subtotal:{" "}
                <strong>
                  {formatMoney(order.subtotal, order.currencyCode)}
                </strong>
              </span>
              <span>
                Discount:{" "}
                <strong>
                  {formatMoney(order.discountAmount, order.currencyCode)}
                </strong>
              </span>
              <span>
                Tax:{" "}
                <strong>
                  {formatMoney(order.taxAmount, order.currencyCode)}
                </strong>
              </span>
              <span>
                Shipping:{" "}
                <strong>
                  {formatMoney(order.shippingAmount, order.currencyCode)}
                </strong>
              </span>
              <span className="text-base">
                Total:{" "}
                <strong>
                  {formatMoney(order.grandTotal, order.currencyCode)}
                </strong>
              </span>
            </div>
          )}
        </Panel>

        {approvals.length > 0 && (
          <Panel title="Approval history">
            <SimpleTable
              rows={approvals}
              keyOf={row => row.id}
              columns={[
                {
                  header: "Requested",
                  cell: row => formatDateTime(row.createdAt),
                },
                {
                  header: "Requested by",
                  cell: row =>
                    `${row.createdBy.firstName ?? ""} ${row.createdBy.lastName ?? ""}`.trim() ||
                    "—",
                },
                {
                  header: "Approver",
                  cell: row =>
                    `${row.requestedTo.firstName ?? ""} ${row.requestedTo.lastName ?? ""}`.trim() ||
                    "—",
                },
                {
                  header: "Status",
                  cell: row => <StatusBadge status={row.status} />,
                },
                {
                  header: "Completed",
                  cell: row => formatDateTime(row.completedDate),
                },
                { header: "Comment", cell: row => row.comment ?? "—" },
              ]}
            />
          </Panel>
        )}

        {receipts.length > 0 && (
          <Panel title="Goods receipts">
            <SimpleTable
              rows={receipts}
              keyOf={row => row.id}
              columns={[
                {
                  header: "GRN",
                  cell: row => (
                    <Link
                      href={`/purchasing/goods-receipts/${row.id}`}
                      className="font-mono text-xs text-primary hover:text-info"
                    >
                      {row.grnNumber}
                    </Link>
                  ),
                },
                {
                  header: "Received",
                  cell: row => formatDate(row.receivedDate),
                },
                {
                  header: "Status",
                  cell: row => <StatusBadge status={row.status} />,
                },
                {
                  header: "Qty received",
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
                  cell: row => formatQuantity(row.totalRejectedQuantity),
                },
                {
                  header: "On time",
                  cell: row =>
                    row.isOnTime === null ? (
                      <span className="text-xs text-muted-foreground">
                        no due date
                      </span>
                    ) : row.isOnTime ? (
                      <span className="text-xs font-medium text-success-foreground">
                        Yes
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-error-foreground">
                        Late
                      </span>
                    ),
                },
              ]}
            />
          </Panel>
        )}
      </PageShell>
    </ProtectedRoute>
  );
}
