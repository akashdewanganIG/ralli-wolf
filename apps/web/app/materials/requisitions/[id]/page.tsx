"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert } from "@repo/ui/components/ui/alert";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
} from "@/hooks/useSupplyChain";
import {
  formatDate,
  formatDateTime,
  formatQuantity,
} from "@/lib/utils/decimal";

export default function MaterialRequisitionDetailPage() {
  const params = useParams<{ id: string }>();
  const requisitionId = Number(params.id);
  const { data, isLoading, error } = useMaterialRequisition(requisitionId);
  const { issueRequisition, cancelRequisition } = useMaterialMutations();

  /** Per-line issue quantity and whether it is consumption or scrap. */
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
      <div className="space-y-5 p-4">
        <PageHeader
          title={
            requisition
              ? `Requisition ${requisition.requisitionNumber}`
              : "Material requisition"
          }
          subtitle={
            requisition
              ? `Issue from ${requisition.warehouse.code} · requested by ${`${requisition.requestedBy.firstName ?? ""} ${requisition.requestedBy.lastName ?? ""}`.trim()}`
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                      className="text-primary hover:underline"
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
          title="Lines"
          description={
            isClosed
              ? "This requisition is closed."
              : "Leave the issue quantity blank on a line to issue everything still outstanding on it. Mark a line as scrap to have it counted as wastage rather than consumption."
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
                ? "bg-red-50/40"
                : ""
            }
            columns={[
              {
                header: "Material",
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
                          ? "font-semibold text-red-700"
                          : "text-emerald-700"
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
      </div>
    </ProtectedRoute>
  );
}
