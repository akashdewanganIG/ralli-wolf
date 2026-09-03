"use client";

import { useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import {
  ErrorBanner,
  PageHeader,
  Pager,
  Panel,
  SelectField,
  SimpleTable,
  StatusBadge,
  DEFAULT_PAGE_SIZE,
} from "@/components/supply-chain/shared";
import { WarehouseFilter } from "@/components/supply-chain/warehouse-filter";
import {
  usePutawayTasks,
  useStorageBins,
  useWmsMutations,
} from "@/hooks/use-supply-chain";
import {
  formatDate,
  formatDateTime,
  formatQuantity,
} from "@/lib/utils/decimal";
import { toast } from "@/lib/toast";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { DashboardToolbar } from "@repo/ui/components/ui/dashboard-toolbar";

export default function PutawayQueuePage() {
  const [page, setPage] = useState(1);
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState("");
  const [binOverride, setBinOverride] = useState<Record<number, string>>({});

  const { tasks, pagination, isLoading, error } = usePutawayTasks({
    page,
    limit: DEFAULT_PAGE_SIZE,
    warehouseId,
    status: status || undefined,
  });
  const { bins } = useStorageBins(warehouseId ?? 0, { limit: 500 });
  const { completePutaway } = useWmsMutations();

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Putaway queue"
          subtitle="Putting newly arrived stock away into the right storage spaces."
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={completePutaway.error} />

        <Panel
          title="Putaway tasks"
          flush
          actions={
            <DashboardToolbar
              actions={[
                <WarehouseFilter
                  key="warehouse"
                  value={warehouseId}
                  onChange={value => {
                    setWarehouseId(value);
                    setPage(1);
                  }}
                  className="w-full sm:w-56"
                />,
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
                  <option value="">Open tasks</option>
                  <option value="PENDING">Pending</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="COMPLETED">Completed</option>
                </SelectField>,
              ]}
            />
          }
        >
          <SimpleTable
            isLoading={isLoading}
            rows={tasks}
            keyOf={row => row.id}
            empty="Nothing waiting for putaway. Tasks appear here automatically when a goods receipt is posted."
            columns={[
              {
                header: "Task",
                cell: row => (
                  <span className="font-mono text-xs text-primary">
                    {row.taskNumber}
                  </span>
                ),
              },
              { header: "Priority", align: "right", cell: row => row.priority },
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
                header: "Lot",
                cell: row => (
                  <div>
                    <span className="font-mono text-xs">
                      {row.lot.lotNumber}
                    </span>
                    {row.lot.expiryDate && (
                      <p className="text-xs text-muted-foreground">
                        exp {formatDate(row.lot.expiryDate)}
                      </p>
                    )}
                  </div>
                ),
              },
              {
                header: "From",
                cell: row => (
                  <span className="font-mono text-xs">{row.fromBin.code}</span>
                ),
              },
              {
                header: "Suggested bin",
                cell: row =>
                  row.status === "COMPLETED" ? (
                    <span className="font-mono text-xs">
                      {row.toBin?.code ?? "—"}
                    </span>
                  ) : (
                    <SelectField
                      className="w-full sm:w-40"
                      value={
                        binOverride[row.id] ??
                        (row.toBin ? String(row.toBin.id) : "")
                      }
                      onChange={event =>
                        setBinOverride(current => ({
                          ...current,
                          [row.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Choose a bin…</option>
                      {row.toBin &&
                        !bins.some(bin => bin.id === row.toBin?.id) && (
                          <option value={row.toBin.id}>
                            {row.toBin.code} (suggested)
                          </option>
                        )}
                      {bins.map(bin => (
                        <option key={bin.id} value={bin.id}>
                          {bin.code}
                          {row.toBin?.id === bin.id ? " (suggested)" : ""}
                        </option>
                      ))}
                    </SelectField>
                  ),
              },
              {
                header: "Quantity",
                align: "right",
                cell: row => formatQuantity(row.quantity),
              },
              {
                header: "Moved",
                align: "right",
                cell: row => formatQuantity(row.movedQuantity),
              },
              {
                header: "Status",
                cell: row => <StatusBadge status={row.status} />,
              },
              { header: "Created", cell: row => formatDateTime(row.createdAt) },
              {
                header: "",
                cell: row =>
                  row.status === "COMPLETED" || row.status === "CANCELLED" ? (
                    <span className="text-xs text-muted-foreground">
                      closed
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={completePutaway.isPending}
                      onClick={() => {
                        const chosen =
                          binOverride[row.id] ??
                          (row.toBin ? String(row.toBin.id) : "");
                        if (!chosen) {
                          toast.warning("Choose a destination bin", {
                            description:
                              "Select a bin before completing this putaway.",
                          });
                          return;
                        }
                        completePutaway.mutate({
                          id: row.id,
                          payload: { toBinId: Number(chosen) },
                        });
                      }}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                    >
                      Complete
                    </button>
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
