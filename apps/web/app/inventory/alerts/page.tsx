"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { Alert } from "@repo/ui/components/ui/alert";
import { ProtectedRoute } from "@/components/protected-route";
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
  DEFAULT_PAGE_SIZE,
} from "@/components/supply-chain/shared";
import { WarehouseFilter } from "@/components/supply-chain/warehouse-filter";
import {
  useInventoryMutations,
  useStockAlerts,
} from "@/hooks/use-supply-chain";
import {
  formatDateTime,
  formatQuantity,
  humanizeEnum,
} from "@/lib/utils/decimal";
import type { StockAlertType } from "@/lib/api/types/supply-chain";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { DashboardToolbar } from "@repo/ui/components/ui/dashboard-toolbar";
import { Tag } from "@repo/ui/components/ui/tag";
import { DataTransfer } from "@/components/data-transfer/data-transfer";

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
    limit: DEFAULT_PAGE_SIZE,
    status: status || undefined,
    severity: severity || undefined,
    alertType: alertType || undefined,
    warehouseId,
  });

  const { acknowledgeAlert, resolveAlert, evaluateAlerts } =
    useInventoryMutations();

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Stock alerts"
          subtitle="Warnings about stock running low or about to expire."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => evaluateAlerts.mutate({ warehouseId })}
                disabled={evaluateAlerts.isPending}
                className="px-3 whitespace-nowrap"
              >
                {evaluateAlerts.isPending ? "Evaluating…" : "Re-evaluate now"}
              </Button>
              <DataTransfer entity="stock-alerts" />
            </div>
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
                className="font-medium text-primary transition-colors hover:text-info"
              >
                {evaluateAlerts.data.data.requisitionsCreated} purchase
                requisition(s) raised
              </Link>
            ) : (
              "no requisitions raised"
            )}
          </Alert>
        )}

        <div className="grid-auto-fit gap-3">
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

        <Panel
          title="Alerts"
          flush
          actions={
            <DashboardToolbar
              actions={[
                <SelectField
                  key="status"
                  aria-label="Filter by status"
                  className="w-full sm:w-44"
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
                </SelectField>,
                <SelectField
                  key="severity"
                  aria-label="Filter by severity"
                  className="w-full sm:w-36"
                  value={severity}
                  onChange={event => {
                    setSeverity(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Any severity</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </SelectField>,
                <SelectField
                  key="alert-type"
                  aria-label="Filter by alert type"
                  className="w-full sm:w-48"
                  value={alertType}
                  onChange={event => {
                    setAlertType(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Any type</option>
                  {ALERT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {humanizeEnum(type)}
                    </option>
                  ))}
                </SelectField>,
                <WarehouseFilter
                  key="warehouse"
                  value={warehouseId}
                  onChange={value => {
                    setWarehouseId(value);
                    setPage(1);
                  }}
                />,
              ]}
            />
          }
        >
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
              {
                header: "Type",
                cell: row => (row.alertType ? <Tag>{row.alertType}</Tag> : "—"),
              },
              {
                header: "Item",
                cell: row => (
                  <Link
                    href={`/inventory/stock/${row.product.id}?warehouseId=${row.warehouse.id}`}
                    className="text-primary hover:text-info"
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
                        ? "font-semibold text-error-foreground"
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
            onChange={setPage}
          />
        </Panel>
      </PageShell>
    </ProtectedRoute>
  );
}
