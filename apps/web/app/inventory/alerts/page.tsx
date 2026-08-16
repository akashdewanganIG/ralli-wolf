"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { Alert } from "@repo/ui/components/ui/alert";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  ErrorBanner,
  PageHeader,
  Pager,
  Panel,
  SeverityBadge,
  SelectField,
  SimpleTable,
  StatCard,
  StatusBadge,
} from "@/components/supply-chain/shared";
import { WarehouseFilter } from "@/components/supply-chain/WarehouseFilter";
import { useInventoryMutations, useStockAlerts } from "@/hooks/useSupplyChain";
import {
  formatDateTime,
  formatQuantity,
  humanizeEnum,
} from "@/lib/utils/decimal";
import type { StockAlertType } from "@/lib/api/types/supplyChain";

const ALERT_TYPES: StockAlertType[] = [
  "STOCKOUT",
  "BELOW_SAFETY_STOCK",
  "REORDER_POINT",
  "OVERSTOCK",
  "EXPIRY_WARNING",
  "EXPIRED",
  "NEGATIVE_STOCK",
];

export default function StockAlertsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("OPEN");
  const [severity, setSeverity] = useState("");
  const [alertType, setAlertType] = useState("");
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);

  const { alerts, pagination, summary, isLoading, error } = useStockAlerts({
    page,
    limit: 25,
    status: status || undefined,
    severity: severity || undefined,
    alertType: alertType || undefined,
    warehouseId,
  });

  const { acknowledgeAlert, resolveAlert, evaluateAlerts } =
    useInventoryMutations();

  return (
    <ProtectedRoute>
      <div className="space-y-5 p-4">
        <PageHeader
          title="Stock alerts"
          subtitle="Review and resolve replenishment and expiry exceptions."
          actions={
            <Button
              type="button"
              onClick={() => evaluateAlerts.mutate({ warehouseId })}
              disabled={evaluateAlerts.isPending}
              className="px-3 whitespace-nowrap"
            >
              {evaluateAlerts.isPending ? "Evaluating…" : "Re-evaluate now"}
            </Button>
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={evaluateAlerts.error} />
        <ErrorBanner error={acknowledgeAlert.error} />
        <ErrorBanner error={resolveAlert.error} />

        {evaluateAlerts.isSuccess && evaluateAlerts.data && (
          <Alert tone="info" title="Alert evaluation complete">
            {evaluateAlerts.data.data.evaluatedRules} rule(s) evaluated ·{" "}
            {evaluateAlerts.data.data.raised} raised ·{" "}
            {evaluateAlerts.data.data.resolved} resolved ·{" "}
            {evaluateAlerts.data.data.requisitionsCreated > 0 ? (
              <Link
                href="/purchasing/requisitions"
                className="font-medium underline"
              >
                {evaluateAlerts.data.data.requisitionsCreated} purchase
                requisition(s) raised
              </Link>
            ) : (
              "no requisitions raised"
            )}
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Critical"
            value={summary.CRITICAL ?? 0}
            tone={summary.CRITICAL ? "critical" : "neutral"}
          />
          <StatCard
            label="High"
            value={summary.HIGH ?? 0}
            tone={summary.HIGH ? "warning" : "neutral"}
          />
          <StatCard label="Medium" value={summary.MEDIUM ?? 0} />
          <StatCard label="Low" value={summary.LOW ?? 0} />
        </div>

        <Panel>
          <div className="mb-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
            <div className="w-full sm:w-44">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Status
              </label>
              <SelectField
                value={status}
                onChange={event => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Open and acknowledged</option>
                <option value="OPEN">Open</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="RESOLVED">Resolved</option>
                <option value="DISMISSED">Dismissed</option>
              </SelectField>
            </div>
            <div className="w-full sm:w-40">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Severity
              </label>
              <SelectField
                value={severity}
                onChange={event => {
                  setSeverity(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Any</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </SelectField>
            </div>
            <div className="w-full sm:w-52">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Alert type
              </label>
              <SelectField
                value={alertType}
                onChange={event => {
                  setAlertType(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Any</option>
                {ALERT_TYPES.map(type => (
                  <option key={type} value={type}>
                    {humanizeEnum(type)}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="w-full sm:w-56">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Warehouse
              </label>
              <WarehouseFilter
                value={warehouseId}
                onChange={value => {
                  setWarehouseId(value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <SimpleTable
            isLoading={isLoading}
            rows={alerts}
            keyOf={row => row.id}
            empty="No alerts match these filters. Configure reorder policies to have the engine watch your stock."
            columns={[
              {
                header: "Severity",
                cell: row => <SeverityBadge severity={row.severity} />,
              },
              { header: "Type", cell: row => humanizeEnum(row.alertType) },
              {
                header: "Item",
                cell: row => (
                  <Link
                    href={`/inventory/stock/${row.product.id}?warehouseId=${row.warehouse.id}`}
                    className="text-primary hover:underline"
                  >
                    <span className="font-mono text-xs">
                      {row.product.code}
                    </span>
                    <span className="ml-2 text-sm">{row.product.name}</span>
                  </Link>
                ),
              },
              { header: "Warehouse", cell: row => row.warehouse.code },
              {
                header: "Current",
                align: "right",
                cell: row => formatQuantity(row.currentQuantity),
              },
              {
                header: "Threshold",
                align: "right",
                cell: row => formatQuantity(row.thresholdQuantity),
              },
              {
                header: "Shortfall",
                align: "right",
                cell: row => (
                  <span
                    className={
                      Number(row.shortfallQuantity) > 0
                        ? "font-semibold text-red-700"
                        : ""
                    }
                  >
                    {formatQuantity(row.shortfallQuantity)}
                  </span>
                ),
              },
              {
                header: "Message",
                cell: row => (
                  <span className="text-xs text-muted-foreground">
                    {row.message}
                  </span>
                ),
              },
              { header: "Raised", cell: row => formatDateTime(row.createdAt) },
              {
                header: "Status",
                cell: row => <StatusBadge status={row.status} />,
              },
              {
                header: "Actions",
                cell: row =>
                  row.status === "RESOLVED" || row.status === "DISMISSED" ? (
                    <span className="text-xs text-muted-foreground">
                      closed
                    </span>
                  ) : (
                    <div className="flex gap-2">
                      {row.status === "OPEN" && (
                        <button
                          type="button"
                          onClick={() =>
                            acknowledgeAlert.mutate({ id: row.id })
                          }
                          disabled={acknowledgeAlert.isPending}
                          className="rounded border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50 whitespace-nowrap"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => resolveAlert.mutate({ id: row.id })}
                        disabled={resolveAlert.isPending}
                        className="rounded border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50 whitespace-nowrap"
                      >
                        Resolve
                      </button>
                    </div>
                  ),
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
