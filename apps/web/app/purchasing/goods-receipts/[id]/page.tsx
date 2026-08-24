"use client";

import { useState } from "react";
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
} from "@/components/supply-chain/shared";
import {
  useGoodsReceipt,
  useGoodsReceiptMutations,
} from "@/hooks/useSupplyChain";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
  humanizeEnum,
} from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { Tag } from "@repo/ui/components/ui/tag";

export default function GoodsReceiptDetailPage() {
  const params = useParams<{ id: string }>();
  const grnId = Number(params.id);

  const { data, isLoading, error } = useGoodsReceipt(grnId);
  const { post, cancel, recordQualityCheck } = useGoodsReceiptMutations();

  const [qcLineId, setQcLineId] = useState<number | null>(null);
  const [qcForm, setQcForm] = useState({
    inspectedQuantity: "",
    acceptedQuantity: "",
    defectType: "",
    remarks: "",
  });

  const receipt = data?.data;
  const lines = receipt?.lines ?? [];
  const isPosted = receipt?.status === "COMPLETED";
  const isCancelled = receipt?.status === "CANCELLED";
  const pendingQc = lines.filter(line => line.qcResult === "PENDING").length;

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title={
            receipt ? `Goods receipt ${receipt.grnNumber}` : "Goods receipt"
          }
          subtitle={
            receipt
              ? `${receipt.supplier.name} · into ${receipt.warehouse.code} · received ${formatDate(receipt.receivedDate)}`
              : undefined
          }
          breadcrumb={[
            { label: "Purchasing", href: "/purchasing" },
            { label: "Goods receipts", href: "/purchasing/goods-receipts" },
            { label: receipt?.grnNumber ?? String(grnId) },
          ]}
          actions={
            receipt && (
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={receipt.status} />
                {!isPosted && !isCancelled && (
                  <>
                    <Button
                      type="button"
                      disabled={post.isPending || pendingQc > 0}
                      title={
                        pendingQc > 0
                          ? `${pendingQc} line(s) still awaiting inspection`
                          : undefined
                      }
                      onClick={() => {
                        if (
                          window.confirm(
                            "Post this receipt? The accepted quantity becomes stock at the cost paid, putaway tasks are raised and the purchase order advances. This cannot be undone."
                          )
                        ) {
                          post.mutate({ id: grnId });
                        }
                      }}
                      className="px-3 whitespace-nowrap"
                    >
                      {post.isPending ? "Posting…" : "Post to stock"}
                    </Button>
                    <Button
                      type="button"
                      disabled={cancel.isPending}
                      onClick={() => {
                        const reason =
                          window.prompt(
                            "Reason for cancelling this receipt?"
                          ) ?? undefined;
                        cancel.mutate({ id: grnId, reason });
                      }}
                      variant="outline"
                      className="px-3 text-error-foreground hover:bg-error-surface whitespace-nowrap"
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            )
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={post.error} />
        <ErrorBanner error={cancel.error} />
        <ErrorBanner error={recordQualityCheck.error} />

        {post.isSuccess && (
          <Alert tone="success" title="Receipt posted">
            Stock is now on hand,{" "}
            <Link
              href="/warehouse/putaway"
              className="font-medium text-primary transition-colors hover:text-info"
            >
              putaway tasks have been raised
            </Link>{" "}
            and the purchase order has advanced.
          </Alert>
        )}

        {pendingQc > 0 && !isPosted && (
          <Alert tone="warning" title="Quality inspection pending">
            {pendingQc} line(s) are still awaiting quality inspection. Record
            their results before posting — only the accepted quantity becomes
            stock.
          </Alert>
        )}

        <div className="grid-auto-fit gap-3">
          <StatCard
            label="Received"
            value={
              receipt ? formatQuantity(receipt.totalReceivedQuantity) : "—"
            }
          />
          <StatCard
            label="Accepted"
            value={
              receipt ? formatQuantity(receipt.totalAcceptedQuantity) : "—"
            }
            tone="positive"
            hint="Only this quantity becomes stock"
          />
          <StatCard
            label="Rejected"
            value={
              receipt ? formatQuantity(receipt.totalRejectedQuantity) : "—"
            }
            tone={
              Number(receipt?.totalRejectedQuantity ?? 0) > 0
                ? "critical"
                : "neutral"
            }
          />
          <StatCard
            label="Receipt value"
            value={receipt ? formatMoney(receipt.totalValue) : "—"}
          />
        </div>

        {receipt && (
          <Panel title="Receipt details">
            <div className="grid-auto-fit gap-4">
              <DetailRow
                label="Supplier"
                value={
                  <Link
                    href={`/purchasing/suppliers/${receipt.supplierId}`}
                    className="text-primary hover:text-info"
                  >
                    {receipt.supplier.code} — {receipt.supplier.name}
                  </Link>
                }
              />
              <DetailRow
                label="Purchase order"
                value={
                  receipt.purchaseOrder ? (
                    <Link
                      href={`/purchasing/orders/${receipt.purchaseOrder.id}`}
                      className="text-primary hover:text-info"
                    >
                      {receipt.purchaseOrder.poNumber}
                    </Link>
                  ) : (
                    "Received without a purchase order"
                  )
                }
              />
              <DetailRow
                label="Warehouse"
                value={`${receipt.warehouse.code} — ${receipt.warehouse.name}`}
              />
              <DetailRow
                label="Received date"
                value={formatDate(receipt.receivedDate)}
              />
              <DetailRow
                label="On time"
                value={
                  receipt.isOnTime === null
                    ? "No due date on the order"
                    : receipt.isOnTime
                      ? "Yes"
                      : `${receipt.delayDays} day(s) late`
                }
              />
              <DetailRow
                label="Supplier invoice"
                value={receipt.supplierInvoiceNumber ?? "—"}
              />
              <DetailRow label="Vehicle" value={receipt.vehicleNumber ?? "—"} />
              <DetailRow label="LR number" value={receipt.lrNumber ?? "—"} />
              <DetailRow
                label="Received by"
                value={
                  `${receipt.receivedBy.firstName ?? ""} ${receipt.receivedBy.lastName ?? ""}`.trim() ||
                  "—"
                }
              />
              <DetailRow
                label="Posted at"
                value={formatDateTime(receipt.postedAt)}
              />
              {receipt.notes && (
                <DetailRow label="Notes" value={receipt.notes} />
              )}
            </div>
          </Panel>
        )}

        <Panel flush title="Received lines">
          <SimpleTable
            isLoading={isLoading}
            rows={lines}
            keyOf={row => row.id}
            rowClassName={row =>
              row.qcResult === "FAIL"
                ? "bg-error-surface/40"
                : row.qcResult === "PENDING"
                  ? "bg-warning-surface/30"
                  : ""
            }
            empty="This receipt has no lines."
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
                header: "Tracking",
                cell: row =>
                  row.product.trackingType ? (
                    <Tag>{row.product.trackingType}</Tag>
                  ) : (
                    "—"
                  ),
              },
              {
                header: "Batch / serials",
                cell: row =>
                  row.batchNumber ??
                  (row.serialNumbers.length > 0
                    ? `${row.serialNumbers.length} serial(s)`
                    : "—"),
              },
              { header: "Expiry", cell: row => formatDate(row.expiryDate) },
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
                header: "Unit cost",
                align: "right",
                cell: row => formatMoney(row.unitCost),
              },
              {
                header: "QC",
                cell: row => <StatusBadge status={row.qcResult} />,
              },
              {
                header: "Lot",
                cell: row =>
                  row.lot ? (
                    <span className="font-mono text-xs">
                      {row.lot.lotNumber}
                    </span>
                  ) : (
                    "—"
                  ),
              },
              {
                header: "Posted",
                cell: row =>
                  row.isPosted ? (
                    <span className="text-xs font-medium text-success-foreground">
                      Yes
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No</span>
                  ),
              },
              {
                header: "",
                cell: row =>
                  row.isPosted || isCancelled ? null : (
                    <button
                      type="button"
                      onClick={() => {
                        setQcLineId(qcLineId === row.id ? null : row.id);
                        setQcForm({
                          inspectedQuantity: String(row.receivedQuantity),
                          acceptedQuantity: String(row.receivedQuantity),
                          defectType: "",
                          remarks: "",
                        });
                      }}
                      className="rounded border px-2 py-1 text-xs hover:bg-muted whitespace-nowrap"
                    >
                      {qcLineId === row.id ? "Cancel" : "Inspect"}
                    </button>
                  ),
              },
            ]}
          />

          {qcLineId !== null && (
            <form
              className="mt-4 grid gap-4 rounded-md border bg-muted/30 p-4 md:grid-cols-5"
              onSubmit={event => {
                event.preventDefault();
                recordQualityCheck.mutate(
                  {
                    grnLineId: qcLineId,
                    payload: {
                      inspectedQuantity: qcForm.inspectedQuantity,
                      acceptedQuantity: qcForm.acceptedQuantity,
                      defectType: qcForm.defectType || undefined,
                      remarks: qcForm.remarks || undefined,
                    },
                  },
                  { onSuccess: () => setQcLineId(null) }
                );
              }}
            >
              <Field label="Inspected quantity">
                <Input
                  required
                  inputMode="decimal"
                  value={qcForm.inspectedQuantity}
                  onChange={e =>
                    setQcForm({ ...qcForm, inspectedQuantity: e.target.value })
                  }
                />
              </Field>
              <Field
                label="Accepted quantity"
                hint="The rest is treated as rejected"
              >
                <Input
                  required
                  inputMode="decimal"
                  value={qcForm.acceptedQuantity}
                  onChange={e =>
                    setQcForm({ ...qcForm, acceptedQuantity: e.target.value })
                  }
                />
              </Field>
              <Field label="Defect type">
                <Input
                  value={qcForm.defectType}
                  onChange={e =>
                    setQcForm({ ...qcForm, defectType: e.target.value })
                  }
                  placeholder="e.g. Dimensional"
                />
              </Field>
              <Field label="Remarks">
                <Input
                  value={qcForm.remarks}
                  onChange={e =>
                    setQcForm({ ...qcForm, remarks: e.target.value })
                  }
                />
              </Field>
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={recordQualityCheck.isPending}
                  className="w-full"
                >
                  {recordQualityCheck.isPending
                    ? "Saving…"
                    : "Record inspection"}
                </Button>
              </div>
            </form>
          )}
        </Panel>

        {lines.some(line => line.qualityChecks.length > 0) && (
          <Panel flush title="Quality inspections">
            <SimpleTable
              rows={lines.flatMap(line =>
                line.qualityChecks.map(check => ({
                  ...check,
                  productCode: line.product.code,
                }))
              )}
              keyOf={row => row.id}
              columns={[
                {
                  header: "QC",
                  cell: row => (
                    <span className="font-mono text-xs">{row.qcNumber}</span>
                  ),
                },
                { header: "Item", cell: row => row.productCode },
                {
                  header: "Inspected",
                  align: "right",
                  cell: row => formatQuantity(row.inspectedQuantity),
                },
                {
                  header: "Accepted",
                  align: "right",
                  cell: row => formatQuantity(row.acceptedQuantity),
                },
                {
                  header: "Rejected",
                  align: "right",
                  cell: row => formatQuantity(row.rejectedQuantity),
                },
                {
                  header: "Result",
                  cell: row => <StatusBadge status={row.result} />,
                },
                { header: "Defect", cell: row => row.defectType ?? "—" },
                {
                  header: "Inspector",
                  cell: row =>
                    `${row.inspectedBy.firstName ?? ""} ${row.inspectedBy.lastName ?? ""}`.trim() ||
                    "—",
                },
                {
                  header: "When",
                  cell: row => formatDateTime(row.inspectedAt),
                },
              ]}
            />
          </Panel>
        )}
      </PageShell>
    </ProtectedRoute>
  );
}
