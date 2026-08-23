"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
import { WarehouseFilter } from "@/components/supply-chain/WarehouseFilter";
import {
  ProductPicker,
  type PickedProduct,
} from "@/components/supply-chain/ProductPicker";
import {
  useMaterialMutations,
  useMaterialRequisitions,
} from "@/hooks/useSupplyChain";
import { formatDate, formatDateTime } from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { FormDialog } from "@repo/ui/components/ui/form-dialog";

interface DraftLine {
  product: PickedProduct | null;
  requestedQuantity: string;
  notes: string;
}

export default function MaterialRequisitionsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [filterWarehouseId, setFilterWarehouseId] = useState<
    number | undefined
  >(undefined);
  const [showForm, setShowForm] = useState(false);

  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [requiredByDate, setRequiredByDate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { product: null, requestedQuantity: "", notes: "" },
  ]);

  const { requisitions, pagination, isLoading, error } =
    useMaterialRequisitions({
      page,
      limit: DEFAULT_PAGE_SIZE,
      status: status || undefined,
      warehouseId: filterWarehouseId,
    });
  const { createRequisition } = useMaterialMutations();

  const validLines = lines.filter(
    line => line.product && Number(line.requestedQuantity) > 0
  );
  const canSubmit =
    !!warehouseId && validLines.length > 0 && !createRequisition.isPending;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!warehouseId || validLines.length === 0) return;

    createRequisition.mutate(
      {
        warehouseId,
        requiredByDate: requiredByDate || undefined,
        purpose: purpose || undefined,
        lines: validLines.map(line => ({
          productId: line.product!.id,
          requestedQuantity: line.requestedQuantity,
          notes: line.notes || undefined,
        })),
      },
      {
        onSuccess: result => {
          setShowForm(false);
          setLines([{ product: null, requestedQuantity: "", notes: "" }]);
          setPurpose("");
          setRequiredByDate("");
          router.push(
            `/materials/requisitions/${(result.data as { id: number }).id}`
          );
        },
      }
    );
  };

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Material requisitions"
          subtitle="Request, approve, and issue materials to operations."
          actions={
            <Button
              type="button"
              onClick={() => setShowForm(true)}
              className="px-3 whitespace-nowrap"
            >
              New requisition
            </Button>
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={createRequisition.error} />

        <FormDialog
          open={showForm}
          onOpenChange={setShowForm}
          title="New material requisition"
        >
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Issue from warehouse" composite>
                <WarehouseFilter
                  value={warehouseId}
                  onChange={setWarehouseId}
                  allowAll={false}
                  required
                />
              </Field>
              <Field label="Required by">
                <Input
                  type="date"
                  value={requiredByDate}
                  onChange={event => setRequiredByDate(event.target.value)}
                />
              </Field>
              <Field label="Purpose">
                <Input
                  value={purpose}
                  onChange={event => setPurpose(event.target.value)}
                  placeholder="e.g. Line 2 assembly"
                />
              </Field>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Lines</p>
              {lines.map((line, index) => (
                <div
                  key={index}
                  className="grid gap-2 md:grid-cols-[2fr,1fr,1fr,auto]"
                >
                  <ProductPicker
                    value={line.product}
                    onChange={product =>
                      setLines(current =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, product } : entry
                        )
                      )
                    }
                  />
                  <Input
                    placeholder="Quantity"
                    inputMode="decimal"
                    value={line.requestedQuantity}
                    onChange={event =>
                      setLines(current =>
                        current.map((entry, i) =>
                          i === index
                            ? {
                                ...entry,
                                requestedQuantity: event.target.value,
                              }
                            : entry
                        )
                      )
                    }
                  />
                  <Input
                    placeholder="Notes"
                    value={line.notes}
                    onChange={event =>
                      setLines(current =>
                        current.map((entry, i) =>
                          i === index
                            ? { ...entry, notes: event.target.value }
                            : entry
                        )
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setLines(current => current.filter((_, i) => i !== index))
                    }
                    disabled={lines.length === 1}
                    className="rounded border px-3 text-sm hover:bg-muted disabled:opacity-40 whitespace-nowrap"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setLines(current => [
                    ...current,
                    { product: null, requestedQuantity: "", notes: "" },
                  ])
                }
                className="rounded border px-3 py-1.5 text-sm hover:bg-muted whitespace-nowrap"
              >
                Add line
              </button>
            </div>

            <div className="dialog-form-actions">
              <Button type="submit" disabled={!canSubmit}>
                {createRequisition.isPending
                  ? "Creating…"
                  : "Create requisition"}
              </Button>
            </div>
          </form>
        </FormDialog>

        <Panel
          actions={
            <FilterBar>
              <SelectField
                className="w-full sm:w-48"
                value={status}
                onChange={event => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PARTIALLY_ISSUED">Partially issued</option>
                <option value="ISSUED">Issued</option>
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
            rows={requisitions}
            keyOf={row => row.id}
            onRowClick={row => router.push(`/materials/requisitions/${row.id}`)}
            empty="No material requisitions yet."
            columns={[
              {
                header: "Requisition",
                cell: row => (
                  <span className="font-mono text-xs text-primary">
                    {row.requisitionNumber}
                  </span>
                ),
              },
              { header: "Warehouse", cell: row => row.warehouse.code },
              {
                header: "Lines",
                align: "right",
                cell: row => row._count?.lines ?? 0,
              },
              {
                header: "Required by",
                cell: row => formatDate(row.requiredByDate),
              },
              { header: "Purpose", cell: row => row.purpose ?? "—" },
              {
                header: "Production order",
                cell: row => row.productionOrder?.orderNumber ?? "—",
              },
              {
                header: "Status",
                cell: row => <StatusBadge status={row.status} />,
              },
              {
                header: "Requested by",
                cell: row =>
                  `${row.requestedBy.firstName ?? ""} ${row.requestedBy.lastName ?? ""}`.trim() ||
                  "—",
              },
              { header: "Issued", cell: row => formatDateTime(row.issuedAt) },
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
