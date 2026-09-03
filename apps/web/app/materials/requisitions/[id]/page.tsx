"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert } from "@repo/ui/components/ui/alert";
import { ProtectedRoute } from "@/components/protected-route";
import {
  DetailRow,
  ErrorBanner,
  PageHeader,
  Panel,
  SelectField,
  SimpleTable,
  StatusBadge,
} from "@/components/supply-chain/shared";
import {
  useMaterialMutations,
  useMaterialRequisition,
} from "@/hooks/use-supply-chain";
import {
  formatDate,
  formatDateTime,
  formatQuantity,
} from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";

export default function MaterialRequisitionDetailPage() {
  const params = useParams<{ id: string }>();
  const requisitionId = Number(params.id);
  const { data, isLoading, error } = useMaterialRequisition(requisitionId);
  const { issueRequisition, cancelRequisition } = useMaterialMutations();

  const [issueDraft, setIssueDraft] = useState<
    Record<
      number,
      {
        quantity: string;
        consumptionType: "CONSUMED" | "WASTED";
        reasonCode: string;
      }
    >
  >({});

  const requisition = data?.data;
  const lines = requisition?.lines ?? [];
  const isClosed =
    requisition?.status === "ISSUED" || requisition?.status === "CANCELLED";

  const drafted = Object.entries(issueDraft)
    .filter(([, value]) => value.quantity !== "" && Number(value.quantity) > 0)
    .map(([lineId, value]) => ({
      lineId: Number(lineId),
      quantity: value.quantity,
      consumptionType: value.consumptionType,
      reasonCode: value.reasonCode || undefined,
    }));

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title={
            requisition
              ? `Requisition ${requisition.requisitionNumber}`
              : "Material requisition"
          }
          subtitle={
            requisition
              ? `A request for materials from ${requisition.warehouse.code}, made by ${`${requisition.requestedBy.firstName ?? ""} ${requisition.requestedBy.lastName ?? ""}`.trim()}.`
              : undefined
          }
          breadcrumb={[
            { label: "Materials", href: "/materials" },
            { label: "Requisitions", href: "/materials/requisitions" },
            { label: requisition?.requisitionNumber ?? String(requisitionId) },
          ]}
          actions={
            requisition && (
              <div className="flex items-center gap-2">
                <StatusBadge status={requisition.status} />
                {!isClosed && (
                  <>
                    <Button
                      type="button"
                      disabled={issueRequisition.isPending}
                      onClick={() =>
                        issueRequisition.mutate(
                          {
                            id: requisitionId,
                            payload:
                              drafted.length > 0
                                ? { lines: drafted }
                                : undefined,
                          },
                          { onSuccess: () => setIssueDraft({}) }
                        )
                      }
                      className="px-3 whitespace-nowrap"
                    >
                      {issueRequisition.isPending
                        ? "Issuing…"
                        : drafted.length > 0
                          ? `Issue ${drafted.length} line(s)`
                          : "Issue everything outstanding"}
                    </Button>
                    <Button
                      type="button"
                      disabled={cancelRequisition.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Cancel this requisition? Only possible while nothing has been issued."
                          )
                        ) {
                          cancelRequisition.mutate(requisitionId);
                        }
                      }}
                      variant="outline"
                      className="px-3 whitespace-nowrap"
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
        <ErrorBanner error={issueRequisition.error} />
        <ErrorBanner error={cancelRequisition.error} />

        {issueRequisition.isSuccess && (
          <Alert tone="success" title="Material issued">
            The stock ledger now shows the consumption against the specific lots
            taken.
          </Alert>
        )}

        {requisition && (
          <Panel title="Requisition details">
            <div className="grid-auto-fit gap-4">
              <DetailRow
                label="Warehouse"
                value={`${requisition.warehouse.code} — ${requisition.warehouse.name}`}
              />
              <DetailRow
                label="Required by"
                value={formatDate(requisition.requiredByDate)}
              />
              <DetailRow label="Purpose" value={requisition.purpose ?? "—"} />
              <DetailRow
                label="Production order"
                value={
                  requisition.productionOrder ? (
                    <Link
                      href={`/production/${requisition.productionOrder.id}`}
                      className="text-primary hover:text-info"
                    >
                      {requisition.productionOrder.orderNumber}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow
                label="Issued by"
                value={
                  requisition.issuedBy
                    ? `${requisition.issuedBy.firstName ?? ""} ${requisition.issuedBy.lastName ?? ""}`.trim()
                    : "—"
                }
              />
              <DetailRow
                label="Issued at"
                value={formatDateTime(requisition.issuedAt)}
              />
              {requisition.notes && (
                <DetailRow label="Notes" value={requisition.notes} />
              )}
            </div>
          </Panel>
        )}

        <Panel
          flush
          title="Lines"
          description={
            isClosed
              ? "This request is finished, so it can only be viewed."
              : "Hand out the parts that were asked for. Leave the amount blank to give everything still owed, or mark a line as scrap if it was wasted rather than used."
          }
        >
          <SimpleTable
            isLoading={isLoading}
            rows={lines}
            keyOf={row => row.id}
            empty="This requisition has no lines."
            rowClassName={row =>
              row.availableQuantity !== undefined &&
              Number(row.availableQuantity) <
                Number(row.requestedQuantity) - Number(row.issuedQuantity)
                ? "bg-error-surface/40"
                : ""
            }
            columns={[
              {
                header: "Material",
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
                header: "UoM",
                cell: row => row.uom?.code ?? row.product.uom?.code ?? "—",
              },
              {
                header: "Requested",
                align: "right",
                cell: row => formatQuantity(row.requestedQuantity),
              },
              {
                header: "Issued",
                align: "right",
                cell: row => formatQuantity(row.issuedQuantity),
              },
              {
                header: "Outstanding",
                align: "right",
                cell: row =>
                  formatQuantity(
                    Number(row.requestedQuantity) - Number(row.issuedQuantity)
                  ),
              },
              {
                header: "Available in store",
                align: "right",
                cell: row => {
                  if (row.availableQuantity === undefined) return "—";
                  const outstanding =
                    Number(row.requestedQuantity) - Number(row.issuedQuantity);
                  const short = Number(row.availableQuantity) < outstanding;
                  return (
                    <span
                      className={
                        short
                          ? "font-semibold text-error-foreground"
                          : "text-success-foreground"
                      }
                    >
                      {formatQuantity(row.availableQuantity)}
                    </span>
                  );
                },
              },
              {
                header: "Issue now",
                align: "right",
                cell: row =>
                  isClosed ? (
                    "—"
                  ) : (
                    <Input
                      className="w-24 text-right"
                      inputMode="decimal"
                      placeholder="all"
                      value={issueDraft[row.id]?.quantity ?? ""}
                      onChange={event =>
                        setIssueDraft(current => ({
                          ...current,
                          [row.id]: {
                            quantity: event.target.value,
                            consumptionType:
                              current[row.id]?.consumptionType ?? "CONSUMED",
                            reasonCode: current[row.id]?.reasonCode ?? "",
                          },
                        }))
                      }
                    />
                  ),
              },
              {
                header: "As",
                cell: row =>
                  isClosed ? (
                    "—"
                  ) : (
                    <SelectField
                      className="w-32"
                      value={issueDraft[row.id]?.consumptionType ?? "CONSUMED"}
                      onChange={event =>
                        setIssueDraft(current => ({
                          ...current,
                          [row.id]: {
                            quantity: current[row.id]?.quantity ?? "",
                            consumptionType: event.target.value as
                              | "CONSUMED"
                              | "WASTED",
                            reasonCode: current[row.id]?.reasonCode ?? "",
                          },
                        }))
                      }
                    >
                      <option value="CONSUMED">Consumption</option>
                      <option value="WASTED">Scrap / wastage</option>
                    </SelectField>
                  ),
              },
              { header: "Notes", cell: row => row.notes ?? "—" },
            ]}
          />
        </Panel>
      </PageShell>
    </ProtectedRoute>
  );
}
