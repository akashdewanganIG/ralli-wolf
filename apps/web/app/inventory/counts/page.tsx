"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import {
  ErrorBanner,
  FilterBar,
  Field,
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
  useInventoryMutations,
  useStockCounts,
} from "@/hooks/use-supply-chain";
import { formatDateTime, humanizeEnum } from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { FormDialog } from "@repo/ui/components/ui/form-dialog";
import { Tag } from "@repo/ui/components/ui/tag";
import { DataTransfer } from "@/components/data-transfer/data-transfer";

export default function StockCountsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filterWarehouseId, setFilterWarehouseId] = useState<
    number | undefined
  >(undefined);
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [countType, setCountType] = useState("CYCLE");
  const [notes, setNotes] = useState("");

  const { counts, pagination, isLoading, error } = useStockCounts({
    page,
    limit: DEFAULT_PAGE_SIZE,
    warehouseId: filterWarehouseId,
    status: status || undefined,
  });
  const { createCount } = useInventoryMutations();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!warehouseId) return;
    createCount.mutate(
      { warehouseId, countType, notes: notes || undefined },
      {
        onSuccess: result => {
          setShowForm(false);
          setNotes("");
          const created = result.data as { id: number };
          router.push(`/inventory/counts/${created.id}`);
        },
      }
    );
  };

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Stock counts"
          subtitle="Counting what is really on the shelves, and fixing the records to match."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => setShowForm(true)}
                className="px-3 whitespace-nowrap"
              >
                Start a count
              </Button>
              <DataTransfer entity="stock-counts" />
            </div>
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={createCount.error} />

        <FormDialog
          open={showForm}
          onOpenChange={setShowForm}
          title="Start a count"
          onSubmit={submit}
          bodyClassName="gap-3 md:grid-cols-3"
          isSubmitting={createCount.isPending}
          submitDisabled={!warehouseId}
          submitLabel="Create count sheet"
        >
          <Field label="Warehouse" composite>
            <WarehouseFilter
              value={warehouseId}
              onChange={setWarehouseId}
              allowAll={false}
              required
            />
          </Field>
          <Field
            label="Count type"
            hint="Cycle counts a subset; full counts everything on hand"
          >
            <SelectField
              value={countType}
              onChange={event => setCountType(event.target.value)}
            >
              <option value="CYCLE">Cycle</option>
              <option value="FULL">Full</option>
              <option value="SPOT">Spot</option>
            </SelectField>
          </Field>
          <Field label="Notes">
            <Input
              value={notes}
              onChange={event => setNotes(event.target.value)}
              placeholder="Optional"
            />
          </Field>
        </FormDialog>

        <Panel
          flush
          actions={
            <FilterBar>
              <SelectField
                className="w-full sm:w-44"
                value={status}
                onChange={event => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </SelectField>
              <div className="w-full sm:w-56">
                <WarehouseFilter
                  value={filterWarehouseId}
                  onChange={value => {
                    setFilterWarehouseId(value);
                    setPage(1);
                  }}
                />
              </div>
            </FilterBar>
          }
        >
          <SimpleTable
            isLoading={isLoading}
            rows={counts}
            keyOf={row => row.id}
            onRowClick={row => router.push(`/inventory/counts/${row.id}`)}
            empty="No counts yet."
            columns={[
              {
                header: "Count",
                cell: row => (
                  <span className="font-mono text-xs text-primary">
                    {row.countNumber}
                  </span>
                ),
              },
              { header: "Warehouse", cell: row => row.warehouse?.code ?? "—" },
              {
                header: "Type",
                cell: row => (row.countType ? <Tag>{row.countType}</Tag> : "—"),
              },
              {
                header: "Lines",
                align: "right",
                cell: row => row._count?.lines ?? 0,
              },
              {
                header: "Status",
                cell: row => <StatusBadge status={row.status} />,
              },
              { header: "Started", cell: row => formatDateTime(row.startedAt) },
              {
                header: "Completed",
                cell: row => formatDateTime(row.completedAt),
              },
              {
                header: "Counted by",
                cell: row =>
                  row.countedBy
                    ? `${row.countedBy.firstName ?? ""} ${row.countedBy.lastName ?? ""}`.trim() ||
                      "—"
                    : "—",
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
