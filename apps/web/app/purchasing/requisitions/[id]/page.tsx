"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import Link from "next/link";
import { Alert } from "@repo/ui/components/ui/alert";
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
  usePurchaseRequisition,
  usePurchasingMutations,
  useSuppliers,
} from "@/hooks/useSupplyChain";
import {
  formatDate,
  formatMoney,
  formatQuantity,
  humanizeEnum,
} from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { buttonVariants } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

export default function PurchaseRequisitionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const requisitionId = Number(params.id);

  const { data, isLoading, error } = usePurchaseRequisition(requisitionId);
  const { setRequisitionStatus, convertRequisition } = usePurchasingMutations();
  const { suppliers } = useSuppliers({ limit: 200, status: "ACTIVE" });

  const [supplierId, setSupplierId] = useState("");
  const [taxPercent, setTaxPercent] = useState("18");

  const requisition = data?.data;
  const lines = requisition?.lines ?? [];
  const outstandingLines = lines.filter(
    line => Number(line.quantity) > Number(line.orderedQuantity)
  );

  const canApprove =
    requisition?.status === "DRAFT" ||
    requisition?.status === "PENDING_APPROVAL";
  const canConvert =
    (requisition?.status === "APPROVED" ||
      requisition?.status === "PARTIALLY_CONVERTED") &&
    outstandingLines.length > 0;

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title={
            requisition
              ? `Requisition ${requisition.requisitionNumber}`
              : "Purchase requisition"
          }
          subtitle={
            requisition
              ? `${requisition.warehouse.code} · ${humanizeEnum(requisition.origin)} · raised by ${`${requisition.requestedBy.firstName ?? ""} ${requisition.requestedBy.lastName ?? ""}`.trim()}`
              : undefined
          }
          breadcrumb={[
            { label: "Purchasing", href: "/purchasing" },
            { label: "Requisitions", href: "/purchasing/requisitions" },
            { label: requisition?.requisitionNumber ?? String(requisitionId) },
          ]}
          actions={
            requisition && (
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={requisition.status} />
                {canApprove && (
                  <>
                    <Button
                      type="button"
                      onClick={() =>
                        setRequisitionStatus.mutate({
                          id: requisitionId,
                          status: "APPROVED",
                        })
                      }
                      disabled={setRequisitionStatus.isPending}
                      className="px-3 whitespace-nowrap"
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        const reason =
                          window.prompt(
                            "Reason for rejecting this requisition?"
                          ) ?? undefined;
                        setRequisitionStatus.mutate({
                          id: requisitionId,
                          status: "REJECTED",
                          reason,
                        });
                      }}
                      disabled={setRequisitionStatus.isPending}
                      variant="outline"
                      className="px-3 text-error-foreground hover:bg-error-surface whitespace-nowrap"
                    >
                      Reject
                    </Button>
                  </>
                )}
              </div>
            )
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={setRequisitionStatus.error} />
        <ErrorBanner error={convertRequisition.error} />

        {requisition?.origin === "REORDER_RULE" && (
          <Alert tone="info" title="Automatically raised requisition">
            This requisition was raised automatically because stock reached its
            configured reorder point.{" "}
            <Link
              href="/inventory/reorder-rules"
              className="font-medium text-primary transition-colors hover:text-info"
            >
              Review the reorder policies
            </Link>
            .
          </Alert>
        )}

        <div className="grid-auto-fit gap-3">
          <StatCard
            label="Lines"
            value={lines.length}
            hint={`${outstandingLines.length} not yet ordered`}
          />
          <StatCard
            label="Estimated value"
            value={requisition ? formatMoney(requisition.estimatedValue) : "—"}
          />
          <StatCard
            label="Purchase orders raised"
            value={requisition?.purchaseOrders?.length ?? 0}
          />
          <StatCard
            label="Required by"
            value={requisition ? formatDate(requisition.requiredByDate) : "—"}
          />
        </div>

        {canConvert && (
          <Panel
            title="Convert to a purchase order"
            description="Only lines that have not been fully ordered are included, so converting twice cannot double-order. Prices come from the supplier's catalogue where the estimate is blank."
          >
            <form
              className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap"
              onSubmit={event => {
                event.preventDefault();
                if (!supplierId) return;
                convertRequisition.mutate(
                  {
                    id: requisitionId,
                    payload: { supplierId: Number(supplierId), taxPercent },
                  },
                  {
                    onSuccess: result =>
                      router.push(
                        `/purchasing/orders/${(result.data as { id: number }).id}`
                      ),
                  }
                );
              }}
            >
              <Field label="Supplier" className="w-full sm:w-72">
                <SelectField
                  required
                  value={supplierId}
                  onChange={event => setSupplierId(event.target.value)}
                >
                  <option value="">Choose a supplier…</option>
                  {suppliers
                    .filter(supplier => !supplier.isBlacklisted)
                    .map(supplier => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.code} — {supplier.name}
                      </option>
                    ))}
                </SelectField>
              </Field>
              <Field label="Tax %" className="w-full sm:w-28">
                <Input
                  inputMode="decimal"
                  value={taxPercent}
                  onChange={event => setTaxPercent(event.target.value)}
                />
              </Field>
              <button
                type="submit"
                disabled={!supplierId || convertRequisition.isPending}
                data-slot="button"
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "w-full sm:w-auto"
                )}
              >
                {convertRequisition.isPending
                  ? "Converting…"
                  : `Raise PO for ${outstandingLines.length} line(s)`}
              </button>
            </form>
          </Panel>
        )}

        {requisition && (
          <Panel title="Requisition details">
            <div className="grid-auto-fit gap-4">
              <DetailRow
                label="Warehouse"
                value={`${requisition.warehouse.code} — ${requisition.warehouse.name}`}
              />
              <DetailRow
                label="Origin"
                value={humanizeEnum(requisition.origin)}
              />
              <DetailRow
                label="Suggested supplier"
                value={requisition.suggestedSupplier?.name ?? "—"}
              />
              <DetailRow
                label="Required by"
                value={formatDate(requisition.requiredByDate)}
              />
              <DetailRow
                label="Justification"
                value={requisition.justification ?? "—"}
              />
              <DetailRow
                label="Approved at"
                value={formatDate(requisition.approvedAt)}
              />
              {requisition.rejectionReason && (
                <DetailRow
                  label="Rejection reason"
                  value={requisition.rejectionReason}
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
            empty="This requisition has no lines."
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
              {
                header: "Requested",
                align: "right",
                cell: row =>
                  `${formatQuantity(row.quantity)} ${row.uom?.code ?? ""}`,
              },
              {
                header: "Ordered",
                align: "right",
                cell: row => formatQuantity(row.orderedQuantity),
              },
              {
                header: "Outstanding",
                align: "right",
                cell: row => {
                  const outstanding =
                    Number(row.quantity) - Number(row.orderedQuantity);
                  return outstanding > 0 ? (
                    <span className="font-semibold text-warning-foreground">
                      {formatQuantity(outstanding)}
                    </span>
                  ) : (
                    <span className="text-success-foreground">ordered</span>
                  );
                },
              },
              {
                header: "Est. unit price",
                align: "right",
                cell: row => formatMoney(row.estimatedUnitPrice),
              },
              {
                header: "Est. line value",
                align: "right",
                cell: row =>
                  formatMoney(
                    Number(row.quantity) * Number(row.estimatedUnitPrice)
                  ),
              },
              {
                header: "Required by",
                cell: row => formatDate(row.requiredByDate),
              },
              { header: "Notes", cell: row => row.notes ?? "—" },
            ]}
          />
        </Panel>

        {requisition?.purchaseOrders &&
          requisition.purchaseOrders.length > 0 && (
            <Panel title="Purchase orders raised from this requisition">
              <SimpleTable
                rows={requisition.purchaseOrders}
                keyOf={row => row.id}
                columns={[
                  {
                    header: "PO",
                    cell: row => (
                      <Link
                        href={`/purchasing/orders/${row.id}`}
                        className="font-mono text-xs text-primary hover:text-info"
                      >
                        {row.poNumber}
                      </Link>
                    ),
                  },
                  {
                    header: "Status",
                    cell: row => <StatusBadge status={row.status} />,
                  },
                  {
                    header: "Value",
                    align: "right",
                    cell: row => formatMoney(row.grandTotal),
                  },
                ]}
              />
            </Panel>
          )}
      </PageShell>
    </ProtectedRoute>
  );
}
