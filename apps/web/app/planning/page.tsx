"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@repo/ui/components/ui/button";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { Tag } from "@repo/ui/components/ui/tag";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  ErrorBanner,
  PageHeader,
  Panel,
  SimpleTable,
  StatCard,
} from "@/components/supply-chain/shared";
import { usePlanningBoard, usePlanningMutations } from "@/hooks/useFinance";
import type { PlanningBoardRow } from "@/lib/api/financeServices";
import { formatDate, formatQuantity } from "@/lib/utils/decimal";
import { DataTransfer } from "@/components/data-transfer/DataTransfer";

const OP_TONE: Record<string, "neutral" | "active" | "progress" | "pending"> = {
  PENDING: "neutral",
  SCHEDULED: "pending",
  IN_PROGRESS: "progress",
  COMPLETED: "active",
  CANCELLED: "neutral",
};

/** The routing for one order, laid out step by step. */
function Operations({ order }: { order: PlanningBoardRow }) {
  if (order.operations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No steps planned yet. Schedule the order to lay its routing out on the
        work centres.
      </p>
    );
  }

  return (
    <ol className="space-y-1.5">
      {order.operations.map(op => (
        <li
          key={op.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface-secondary px-3 py-2"
        >
          <span className="w-8 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
            {op.sequence}
          </span>
          <span className="min-w-0 flex-1 text-sm text-foreground">
            {op.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {op.workCenter.code} · {op.workCenter.name}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.round((op.plannedMinutes / 60) * 10) / 10}h
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(op.scheduledStart)}
          </span>
          <Tag tone={OP_TONE[op.status] ?? "neutral"}>{op.status}</Tag>
        </li>
      ))}
    </ol>
  );
}

export default function PlanningPage() {
  const { data, isLoading, error } = usePlanningBoard();
  // No data is no data, whether it is still coming or never arrived.
  const unknown = isLoading || Boolean(error);
  const { scheduleOrder } = usePlanningMutations();
  const [open, setOpen] = React.useState<number | null>(null);

  const orders = data?.data ?? [];
  const scheduled = orders.filter(o => o.isScheduled).length;
  const awaiting = orders.filter(o => !o.isScheduled && o.canSchedule).length;
  const blocked = orders.filter(o => !o.isScheduled && !o.canSchedule).length;
  const totalHours =
    Math.round(orders.reduce((sum, o) => sum + o.totalHours, 0) * 10) / 10;

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Production planning"
          subtitle="Every order that still has to be made, and the steps each one goes through on the shop floor."
          actions={<DataTransfer entity="production-orders" />}
        />

        <ErrorBanner error={error} />

        <div className="grid-auto-fit gap-3">
          <StatCard
            label="Orders to make"
            value={unknown ? "—" : String(orders.length)}
            hint={
              totalHours > 0
                ? `${totalHours}h of work in total`
                : "Not yet finished"
            }
            tone="neutral"
          />
          <StatCard
            label="Already scheduled"
            value={unknown ? "—" : String(scheduled)}
            hint="Steps laid out on work centres"
            tone="positive"
          />
          <StatCard
            label="Waiting to be scheduled"
            value={unknown ? "—" : String(awaiting)}
            hint="Have a routing, no dates yet"
            tone={awaiting > 0 ? "warning" : "neutral"}
          />
          <StatCard
            label="Cannot be scheduled"
            value={unknown ? "—" : String(blocked)}
            hint="No routing on their bill of materials"
            tone={blocked > 0 ? "critical" : "neutral"}
          />
        </div>

        <Panel
          flush
          title="Production board"
          description="Click an order to see the steps it goes through, in order, and where each one runs."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/planning/capacity"
                className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-[0.8125rem] font-medium text-foreground transition-colors hover:bg-hover"
              >
                Capacity
              </Link>
              <Link
                href="/planning/work-centers"
                className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-[0.8125rem] font-medium text-foreground transition-colors hover:bg-hover"
              >
                Work centres
              </Link>
            </div>
          }
        >
          <SimpleTable
            isLoading={isLoading}
            rows={orders}
            keyOf={row => row.id}
            empty={
              error
                ? "The production board could not be loaded."
                : "Nothing is waiting to be made."
            }
            onRowClick={row => setOpen(open === row.id ? null : row.id)}
            columns={[
              { header: "Order", cell: row => row.orderNumber },
              {
                header: "Product",
                cell: row => (
                  <span>
                    <span className="text-foreground">{row.product.name}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {row.product.code}
                    </span>
                  </span>
                ),
              },
              {
                header: "Quantity",
                align: "right",
                cell: row => formatQuantity(row.plannedQuantity),
              },
              { header: "Plant", cell: row => row.warehouse.code },
              { header: "Status", cell: row => <Tag>{row.status}</Tag> },
              {
                header: "Steps",
                align: "right",
                cell: row => String(row.operations.length),
              },
              {
                header: "Work",
                align: "right",
                cell: row => (row.totalHours > 0 ? `${row.totalHours}h` : "—"),
              },
              {
                header: "Starts",
                cell: row => formatDate(row.plannedStartDate),
              },
              {
                header: "",
                align: "right",
                cell: row =>
                  row.isScheduled ? (
                    <Tag tone="active">Scheduled</Tag>
                  ) : row.canSchedule ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={scheduleOrder.isPending}
                      onClick={event => {
                        event.stopPropagation();
                        scheduleOrder.mutate(row.id);
                      }}
                    >
                      Schedule
                    </Button>
                  ) : row.bom ? (
                    // Dead-end otherwise: the fix is always to put a routing on
                    // the BOM, so send the planner straight there.
                    <Link
                      href={`/bom/${row.bom.id}?tab=routing`}
                      onClick={event => event.stopPropagation()}
                      className="text-xs font-medium text-primary hover:text-info"
                    >
                      Add routing
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No routing
                    </span>
                  ),
              },
            ]}
          />
        </Panel>

        {open !== null && (
          <Panel
            title={`Steps for ${orders.find(o => o.id === open)?.orderNumber ?? ""}`}
            description="Each step runs on one work centre. They happen in this order, one after another."
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(null)}
              >
                Close
              </Button>
            }
          >
            {(() => {
              const order = orders.find(o => o.id === open);
              return order ? <Operations order={order} /> : null;
            })()}
          </Panel>
        )}
      </PageShell>
    </ProtectedRoute>
  );
}
