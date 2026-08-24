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
  useProductionMutations,
  useProductionOrder,
  useProductionVariance,
  useMaterialMutations,
} from "@/hooks/useSupplyChain";
import { productionOrderService } from "@/lib/api/supplyChainServices";
import { useQuery } from "@tanstack/react-query";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatPercent,
  formatQuantity,
} from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { CategorySwitcher } from "@repo/ui/components/ui/category-switcher";

export default function ProductionOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);
  const [tab, setTab] = useState<
    "components" | "availability" | "consumption" | "variance"
  >("components");

  const { data, isLoading, error } = useProductionOrder(orderId);
  const { release, complete, cancel } = useProductionMutations();
  const { createRequisition } = useMaterialMutations();
  const { data: varianceData, isLoading: varianceLoading } =
    useProductionVariance(orderId, tab === "variance");

  const order = data?.data;

  const { data: availabilityData, isLoading: availabilityLoading } = useQuery({
    queryKey: ["supply-chain", "production-orders", orderId, "availability"],
    queryFn: () => productionOrderService.availability(orderId),
    enabled: !!orderId && tab === "availability",
  });

  const [completeForm, setCompleteForm] = useState({
    producedQuantity: "",
    scrappedQuantity: "0",
    batchNumber: "",
  });

  const components = order?.components ?? [];
  const remaining = order
    ? Number(order.plannedQuantity) -
      Number(order.producedQuantity) -
      Number(order.scrappedQuantity)
    : 0;
  const canRelease = order?.status === "DRAFT" || order?.status === "PLANNED";
  const canComplete =
    order?.status === "RELEASED" || order?.status === "IN_PROGRESS";

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title={
            order ? `Production order ${order.orderNumber}` : "Production order"
          }
          subtitle={
            order
              ? `A job to build ${order.product.name}, using parts list ${order.bom.bomNumber}, at ${order.warehouse.code}.`
              : undefined
          }
          breadcrumb={[
            { label: "Production", href: "/production" },
            { label: order?.orderNumber ?? String(orderId) },
          ]}
          actions={
            order && (
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={order.status} />
                {canRelease && (
                  <Button
                    type="button"
                    onClick={() => release.mutate({ id: orderId })}
                    disabled={release.isPending}
                    className="px-3 whitespace-nowrap"
                  >
                    {release.isPending
                      ? "Releasing…"
                      : "Release & reserve materials"}
                  </Button>
                )}
                {order.status !== "COMPLETED" &&
                  order.status !== "CANCELLED" &&
                  order.status !== "CLOSED" && (
                    <Button
                      type="button"
                      onClick={() => {
                        const reason =
                          window.prompt("Reason for cancelling this order?") ??
                          undefined;
                        cancel.mutate({ id: orderId, reason });
                      }}
                      disabled={cancel.isPending}
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
        <ErrorBanner error={release.error} />
        <ErrorBanner error={complete.error} />
        <ErrorBanner error={cancel.error} />
        <ErrorBanner error={createRequisition.error} />

        <div className="grid-auto-fit gap-3">
          <StatCard
            label="Planned"
            value={order ? formatQuantity(order.plannedQuantity) : "—"}
          />
          <StatCard
            label="Produced"
            value={order ? formatQuantity(order.producedQuantity) : "—"}
            tone={remaining <= 0 && order ? "positive" : "neutral"}
            hint={`${formatQuantity(remaining)} still to build`}
          />
          <StatCard
            label="Planned material cost"
            value={order ? formatMoney(order.plannedMaterialCost) : "—"}
          />
          <StatCard
            label="Actual material cost"
            value={order ? formatMoney(order.actualMaterialCost) : "—"}
            tone={
              order &&
              Number(order.actualMaterialCost) >
                Number(order.plannedMaterialCost)
                ? "critical"
                : "neutral"
            }
            hint={
              order
                ? `${Number(order.actualMaterialCost) > Number(order.plannedMaterialCost) ? "Over" : "Under"} plan by ${formatMoney(Math.abs(Number(order.actualMaterialCost) - Number(order.plannedMaterialCost)))}`
                : undefined
            }
          />
        </div>

        {canComplete && (
          <Panel
            title="Book finished goods"
            description="Record how many good units you made. Their cost is the materials used plus labour and overhead, shared across them."
          >
            <form
              className="grid gap-4 md:grid-cols-4"
              onSubmit={event => {
                event.preventDefault();
                complete.mutate(
                  {
                    id: orderId,
                    payload: {
                      producedQuantity: completeForm.producedQuantity,
                      scrappedQuantity:
                        completeForm.scrappedQuantity || undefined,
                      batchNumber: completeForm.batchNumber || undefined,
                    },
                  },
                  {
                    onSuccess: () =>
                      setCompleteForm({
                        producedQuantity: "",
                        scrappedQuantity: "0",
                        batchNumber: "",
                      }),
                  }
                );
              }}
            >
              <Field label="Good units produced">
                <Input
                  required
                  inputMode="decimal"
                  value={completeForm.producedQuantity}
                  onChange={event =>
                    setCompleteForm({
                      ...completeForm,
                      producedQuantity: event.target.value,
                    })
                  }
                  placeholder={`Up to ${formatQuantity(remaining)}`}
                />
              </Field>
              <Field label="Scrapped units">
                <Input
                  inputMode="decimal"
                  value={completeForm.scrappedQuantity}
                  onChange={event =>
                    setCompleteForm({
                      ...completeForm,
                      scrappedQuantity: event.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Batch number" hint="Defaults to the order number">
                <Input
                  value={completeForm.batchNumber}
                  onChange={event =>
                    setCompleteForm({
                      ...completeForm,
                      batchNumber: event.target.value,
                    })
                  }
                />
              </Field>
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={
                    !completeForm.producedQuantity || complete.isPending
                  }
                  className="w-full"
                >
                  {complete.isPending ? "Booking…" : "Book into stock"}
                </Button>
              </div>
            </form>
          </Panel>
        )}

        {order && (
          <Panel title="Order details">
            <div className="grid-auto-fit gap-4">
              <DetailRow
                label="Bill of materials"
                value={
                  <Link
                    href={`/bom/${order.bom.id}`}
                    className="text-primary hover:text-info"
                  >
                    {order.bom.bomNumber} v{order.bom.version}
                    {order.bom.revision}
                  </Link>
                }
              />
              <DetailRow
                label="Warehouse"
                value={`${order.warehouse.code} — ${order.warehouse.name}`}
              />
              <DetailRow
                label="Planned start"
                value={formatDate(order.plannedStartDate)}
              />
              <DetailRow
                label="Planned end"
                value={formatDate(order.plannedEndDate)}
              />
              <DetailRow
                label="Actual start"
                value={formatDateTime(order.actualStartDate)}
              />
              <DetailRow
                label="Actual end"
                value={formatDateTime(order.actualEndDate)}
              />
              <DetailRow
                label="Created by"
                value={
                  `${order.createdBy.firstName ?? ""} ${order.createdBy.lastName ?? ""}`.trim() ||
                  "—"
                }
              />
              {order.notes && <DetailRow label="Notes" value={order.notes} />}
            </div>
          </Panel>
        )}

        <CategorySwitcher
          label="Production order sections"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "components", label: "Components", count: components.length },
            { value: "availability", label: "Material availability" },
            {
              value: "consumption",
              label: "Consumption",
              count: order?.consumption?.length ?? 0,
            },
            { value: "variance", label: "Variance" },
          ]}
        />

        {tab === "components" && (
          <Panel
            flush
            title="Component demand"
            description="The parts this job needs, fixed when the job was created and including expected waste."
            actions={
              order && (
                <Button
                  type="button"
                  disabled={
                    createRequisition.isPending || components.length === 0
                  }
                  onClick={() =>
                    createRequisition.mutate({
                      warehouseId: order.warehouseId,
                      productionOrderId: order.id,
                      purpose: `Materials for ${order.orderNumber}`,
                      lines: components
                        .filter(
                          component =>
                            Number(component.requiredQuantity) >
                            Number(component.issuedQuantity)
                        )
                        .map(component => ({
                          productId: component.productId,
                          requestedQuantity: String(
                            Number(component.requiredQuantity) -
                              Number(component.issuedQuantity)
                          ),
                        })),
                    })
                  }
                  variant="outline"
                  className="px-3 whitespace-nowrap"
                >
                  {createRequisition.isPending
                    ? "Raising…"
                    : "Raise material requisition"}
                </Button>
              )
            }
          >
            {createRequisition.isSuccess && (
              <Alert
                tone="success"
                title="Requisition created"
                className="mb-4"
              >
                <Link
                  href={`/materials/requisitions/${(createRequisition.data?.data as { id: number } | undefined)?.id ?? ""}`}
                  className="font-medium text-primary transition-colors hover:text-info"
                >
                  Open it to issue material
                </Link>
                .
              </Alert>
            )}
            <SimpleTable
              isLoading={isLoading}
              rows={components}
              keyOf={row => row.id}
              empty="This order has no component demand."
              columns={[
                {
                  header: "Component",
                  cell: row => (
                    <Link
                      href={`/inventory/stock/${row.productId}`}
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
                  header: "Required",
                  align: "right",
                  cell: row =>
                    `${formatQuantity(row.requiredQuantity)} ${row.product.uom?.code ?? ""}`,
                },
                {
                  header: "Scrap %",
                  align: "right",
                  cell: row => formatQuantity(row.scrapPercent, 2),
                },
                {
                  header: "Issued",
                  align: "right",
                  cell: row => formatQuantity(row.issuedQuantity),
                },
                {
                  header: "Consumed",
                  align: "right",
                  cell: row => formatQuantity(row.consumedQuantity),
                },
                {
                  header: "Wasted",
                  align: "right",
                  cell: row =>
                    Number(row.wastedQuantity) > 0 ? (
                      <span className="text-error-foreground">
                        {formatQuantity(row.wastedQuantity)}
                      </span>
                    ) : (
                      "—"
                    ),
                },
                {
                  header: "Outstanding",
                  align: "right",
                  cell: row => {
                    const outstanding =
                      Number(row.requiredQuantity) - Number(row.issuedQuantity);
                    return outstanding > 0 ? (
                      <span className="font-semibold text-warning-foreground">
                        {formatQuantity(outstanding)}
                      </span>
                    ) : (
                      <span className="text-success-foreground">issued</span>
                    );
                  },
                },
                {
                  header: "Std unit cost",
                  align: "right",
                  cell: row => formatMoney(row.standardUnitCost),
                },
              ]}
            />
          </Panel>
        )}

        {tab === "availability" && (
          <Panel
            flush
            title="Material availability"
            description="Whether the parts for this job are actually in stock right now."
          >
            {availabilityData && (
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <StatCard
                  label="Can this build run?"
                  value={availabilityData.data.canBuild ? "Yes" : "No"}
                  tone={
                    availabilityData.data.canBuild ? "positive" : "critical"
                  }
                />
                <StatCard
                  label="Buildable from stock"
                  value={formatQuantity(
                    availabilityData.data.buildableQuantity
                  )}
                />
                <StatCard
                  label="Material cost"
                  value={formatMoney(availabilityData.data.totalMaterialCost)}
                />
              </div>
            )}
            <SimpleTable
              isLoading={availabilityLoading}
              rows={availabilityData?.data.lines ?? []}
              keyOf={row => row.productId}
              rowClassName={row => (row.isShort ? "bg-error-surface/40" : "")}
              empty="Nothing to check."
              columns={[
                {
                  header: "Component",
                  cell: row => `${row.productCode} — ${row.productName}`,
                },
                {
                  header: "Required",
                  align: "right",
                  cell: row => formatQuantity(row.requiredQuantity),
                },
                {
                  header: "Available",
                  align: "right",
                  cell: row => formatQuantity(row.availableQuantity),
                },
                {
                  header: "On order",
                  align: "right",
                  cell: row => formatQuantity(row.incomingQuantity),
                },
                {
                  header: "Short by",
                  align: "right",
                  cell: row =>
                    Number(row.shortfallQuantity) > 0 ? (
                      <span className="font-semibold text-error-foreground">
                        {formatQuantity(row.shortfallQuantity)}
                      </span>
                    ) : (
                      <span className="text-success-foreground">covered</span>
                    ),
                },
                {
                  header: "Coverage",
                  align: "right",
                  cell: row => formatPercent(row.coveragePercent),
                },
                {
                  header: "Substitutes",
                  cell: row =>
                    row.substitutes.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {row.substitutes
                          .map(
                            substitute =>
                              `${substitute.productCode} (covers ${formatQuantity(substitute.coverableQuantity)})`
                          )
                          .join(", ")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    ),
                },
              ]}
            />
          </Panel>
        )}

        {tab === "consumption" && (
          <Panel
            flush
            title="Consumption log"
            description="Every part taken out for this job, and anything wasted along the way."
          >
            <SimpleTable
              isLoading={isLoading}
              rows={order?.consumption ?? []}
              keyOf={row => row.id}
              empty="Nothing has been consumed against this order yet."
              rowClassName={row =>
                row.consumptionType === "WASTED" ? "bg-error-surface/30" : ""
              }
              columns={[
                { header: "When", cell: row => formatDateTime(row.occurredAt) },
                {
                  header: "Lot",
                  cell: row => (
                    <span className="font-mono text-xs">
                      {row.lot.lotNumber}
                    </span>
                  ),
                },
                { header: "Batch", cell: row => row.lot.batchNumber ?? "—" },
                {
                  header: "Type",
                  cell: row =>
                    row.consumptionType === "WASTED" ? (
                      <span className="text-xs font-medium text-error-foreground">
                        Scrap
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Consumed
                      </span>
                    ),
                },
                {
                  header: "Quantity",
                  align: "right",
                  cell: row => formatQuantity(row.quantity),
                },
                {
                  header: "Unit cost",
                  align: "right",
                  cell: row => formatMoney(row.unitCost),
                },
                {
                  header: "Value",
                  align: "right",
                  cell: row => formatMoney(row.totalCost),
                },
                { header: "Reason", cell: row => row.reasonCode ?? "—" },
              ]}
            />
          </Panel>
        )}

        {tab === "variance" && (
          <Panel
            flush
            title="Consumption variance"
            description="How much material the job really used compared with what was planned."
          >
            {varianceData && (
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <StatCard
                  label="Planned material cost"
                  value={formatMoney(varianceData.data.plannedMaterialCost)}
                />
                <StatCard
                  label="Actual material cost"
                  value={formatMoney(varianceData.data.actualMaterialCost)}
                />
                <StatCard
                  label="Cost variance"
                  value={formatMoney(varianceData.data.costVariance)}
                  tone={
                    Number(varianceData.data.costVariance) > 0
                      ? "critical"
                      : "positive"
                  }
                  hint={
                    Number(varianceData.data.costVariance) > 0
                      ? "Over plan"
                      : "At or under plan"
                  }
                />
              </div>
            )}
            <SimpleTable
              isLoading={varianceLoading}
              rows={varianceData?.data.lines ?? []}
              keyOf={row => row.productId}
              rowClassName={row =>
                Number(row.varianceQuantity) > 0 ? "bg-error-surface/30" : ""
              }
              empty="No variance to report yet."
              columns={[
                {
                  header: "Component",
                  cell: row => `${row.productCode} — ${row.productName}`,
                },
                {
                  header: "Required",
                  align: "right",
                  cell: row => formatQuantity(row.requiredQuantity),
                },
                {
                  header: "Consumed",
                  align: "right",
                  cell: row => formatQuantity(row.consumedQuantity),
                },
                {
                  header: "Wasted",
                  align: "right",
                  cell: row => formatQuantity(row.wastedQuantity),
                },
                {
                  header: "Variance",
                  align: "right",
                  cell: row => {
                    const variance = Number(row.varianceQuantity);
                    if (variance === 0)
                      return (
                        <span className="text-muted-foreground">on plan</span>
                      );
                    return (
                      <span
                        className={
                          variance > 0
                            ? "font-semibold text-error-foreground"
                            : "font-semibold text-success-foreground"
                        }
                      >
                        {variance > 0 ? "+" : ""}
                        {formatQuantity(row.varianceQuantity)}
                      </span>
                    );
                  },
                },
                {
                  header: "Variance %",
                  align: "right",
                  cell: row => formatPercent(row.variancePercent),
                },
                {
                  header: "Variance value",
                  align: "right",
                  cell: row => formatMoney(row.varianceValue),
                },
              ]}
            />
          </Panel>
        )}
      </PageShell>
    </ProtectedRoute>
  );
}
