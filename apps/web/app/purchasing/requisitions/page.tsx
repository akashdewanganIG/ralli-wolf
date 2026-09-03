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
  ProductPicker,
  type PickedProduct,
} from "@/components/supply-chain/product-picker";
import {
  usePurchaseRequisitions,
  usePurchasingMutations,
} from "@/hooks/use-supply-chain";
import { formatDate, formatMoney, humanizeEnum } from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { FormDialog } from "@repo/ui/components/ui/form-dialog";
import { Tag } from "@repo/ui/components/ui/tag";
import { DataTransfer } from "@/components/data-transfer/data-transfer";

interface DraftLine {
  product: PickedProduct | null;
  quantity: string;
  estimatedUnitPrice: string;
}

export default function PurchaseRequisitionsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [origin, setOrigin] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [requiredByDate, setRequiredByDate] = useState("");
  const [justification, setJustification] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { product: null, quantity: "", estimatedUnitPrice: "" },
  ]);

  const { requisitions, pagination, isLoading, error } =
    usePurchaseRequisitions({
      page,
      limit: DEFAULT_PAGE_SIZE,
      status: status || undefined,
      origin: origin || undefined,
    });
  const { createRequisition } = usePurchasingMutations();

  const validLines = lines.filter(
    line => line.product && Number(line.quantity) > 0
  );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!warehouseId || validLines.length === 0) return;
    createRequisition.mutate(
      {
        warehouseId,
        requiredByDate: requiredByDate || undefined,
        justification: justification || undefined,
        lines: validLines.map(line => ({
          productId: line.product!.id,
          quantity: line.quantity,
          estimatedUnitPrice: line.estimatedUnitPrice || undefined,
        })),
      },
      {
        onSuccess: result => {
          setShowForm(false);
          setLines([{ product: null, quantity: "", estimatedUnitPrice: "" }]);
          router.push(
            `/purchasing/requisitions/${(result.data as { id: number }).id}`
          );
        },
      }
    );
  };

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Purchase requisitions"
          subtitle="Internal requests to buy something, before a real order is placed."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => setShowForm(true)}
                className="px-3 whitespace-nowrap"
              >
                New requisition
              </Button>
              <DataTransfer entity="purchase-requisitions" />
            </div>
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={createRequisition.error} />

        <FormDialog
          open={showForm}
          onOpenChange={setShowForm}
          title="New purchase requisition"
          onSubmit={submit}
          bodyClassName="block space-y-3"
          isSubmitting={createRequisition.isPending}
          submitDisabled={!warehouseId || validLines.length === 0}
          submitLabel="Create requisition"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Deliver to warehouse" composite>
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
            <Field label="Justification">
              <Input
                value={justification}
                onChange={event => setJustification(event.target.value)}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Lines</p>
            {lines.map((line, index) => (
              <div
                key={index}
                className="grid gap-2 md:grid-cols-[3fr,1fr,1fr,auto]"
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
                  value={line.quantity}
                  onChange={event =>
                    setLines(current =>
                      current.map((entry, i) =>
                        i === index
                          ? { ...entry, quantity: event.target.value }
                          : entry
                      )
                    )
                  }
                />
                <Input
                  placeholder="Est. unit price"
                  inputMode="decimal"
                  value={line.estimatedUnitPrice}
                  onChange={event =>
                    setLines(current =>
                      current.map((entry, i) =>
                        i === index
                          ? {
                              ...entry,
                              estimatedUnitPrice: event.target.value,
                            }
                          : entry
                      )
                    )
                  }
                />
                <button
                  type="button"
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines(current => current.filter((_, i) => i !== index))
                  }
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
                  { product: null, quantity: "", estimatedUnitPrice: "" },
                ])
              }
              className="rounded border px-3 py-1.5 text-sm hover:bg-muted whitespace-nowrap"
            >
              Add line
            </button>
          </div>
        </FormDialog>

        <Panel
          title="Requisitions"
          flush
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
                {[
                  "DRAFT",
                  "PENDING_APPROVAL",
                  "APPROVED",
                  "REJECTED",
                  "PARTIALLY_CONVERTED",
                  "CONVERTED",
                  "CANCELLED",
                ].map(value => (
                  <option key={value} value={value}>
                    {humanizeEnum(value)}
                  </option>
                ))}
              </SelectField>
              <SelectField
                className="w-full sm:w-48"
                value={origin}
                onChange={event => {
                  setOrigin(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Any origin</option>
                <option value="MANUAL">Raised manually</option>
                <option value="REORDER_RULE">From a reorder rule</option>
                <option value="MATERIAL_SHORTAGE">
                  From a material shortage
                </option>
              </SelectField>
            </FilterBar>
          }
        >
          <SimpleTable
            isLoading={isLoading}
            rows={requisitions}
            keyOf={row => row.id}
            onRowClick={row =>
              router.push(`/purchasing/requisitions/${row.id}`)
            }
            empty="No requisitions yet."
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
                header: "Origin",
                cell: row =>
                  row.origin === "REORDER_RULE" ? (
                    <Tag tone="progress">automatic</Tag>
                  ) : (
                    humanizeEnum(row.origin)
                  ),
              },
              {
                header: "Lines",
                align: "right",
                cell: row => row._count?.lines ?? 0,
              },
              {
                header: "Estimated value",
                align: "right",
                cell: row => formatMoney(row.estimatedValue),
              },
              {
                header: "Required by",
                cell: row => formatDate(row.requiredByDate),
              },
              {
                header: "Suggested supplier",
                cell: row => row.suggestedSupplier?.name ?? "—",
              },
              {
                header: "POs raised",
                align: "right",
                cell: row => row._count?.purchaseOrders ?? 0,
              },
              {
                header: "Status",
                cell: row => <StatusBadge status={row.status} />,
              },
              { header: "Raised", cell: row => formatDate(row.createdAt) },
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
