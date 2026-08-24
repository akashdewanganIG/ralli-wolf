"use client";

import { useState } from "react";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SearchFilterToolbar } from "@repo/ui/components/ui/toolbar";
import {
  ErrorBanner,
  Field,
  PageHeader,
  Pager,
  Panel,
  SelectField,
  SimpleTable,
  StatusBadge,
  DEFAULT_PAGE_SIZE,
} from "@/components/supply-chain/shared";
import {
  ProductPicker,
  type PickedProduct,
} from "@/components/supply-chain/ProductPicker";
import { useBomMutations, useBoms } from "@/hooks/useSupplyChain";
import { formatDate, formatMoney, formatQuantity } from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { FormDialog } from "@repo/ui/components/ui/form-dialog";

export default function BomListPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [name, setName] = useState("");
  const [outputQuantity, setOutputQuantity] = useState("1");
  const [laborCost, setLaborCost] = useState("0");
  const [overheadCost, setOverheadCost] = useState("0");
  const [isDefault, setIsDefault] = useState(true);

  const { boms, pagination, isLoading, error } = useBoms({
    page,
    limit: DEFAULT_PAGE_SIZE,
    search: search || undefined,
    status: status || undefined,
  });
  const { create } = useBomMutations();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!product || !name) return;
    create.mutate(
      {
        productId: product.id,
        name,
        outputQuantity,
        laborCost,
        overheadCost,
        isDefault,
        components: [],
      },
      {
        onSuccess: result => {
          setShowForm(false);
          setProduct(null);
          setName("");
          router.push(`/bom/${(result.data as { id: number }).id}`);
        },
      }
    );
  };

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Bills of materials"
          subtitle="Recipes that list which parts go into each product you build."
          actions={
            <Button
              type="button"
              onClick={() => setShowForm(true)}
              className="px-3 whitespace-nowrap"
            >
              New BOM
            </Button>
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={create.error} />

        <FormDialog
          open={showForm}
          onOpenChange={setShowForm}
          title="New bill of materials"
          description="This starts as a draft. Add the parts on the next screen, then activate it. Once active it is locked, so past jobs can still be rebuilt exactly."
        >
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-3">
            <Field
              label="Product this BOM builds"
              className="md:col-span-2"
              composite
            >
              <ProductPicker
                value={product}
                onChange={setProduct}
                placeholder="Search the finished tool or assembly…"
                autoFocus
              />
            </Field>
            <Field label="BOM name">
              <Input
                required
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="e.g. 18V Drill — standard build"
              />
            </Field>
            <Field
              label="Output quantity"
              hint="How many finished units one run of this recipe makes"
            >
              <Input
                value={outputQuantity}
                onChange={event => setOutputQuantity(event.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field label="Labour cost per unit">
              <Input
                value={laborCost}
                onChange={event => setLaborCost(event.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field label="Overhead per unit">
              <Input
                value={overheadCost}
                onChange={event => setOverheadCost(event.target.value)}
                inputMode="decimal"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm md:col-span-3">
              <Checkbox checked={isDefault} onCheckedChange={setIsDefault} />
              Make this the default BOM for the product
            </label>
            <div className="md:col-span-3 dialog-form-actions">
              <Button
                type="submit"
                disabled={!product || !name || create.isPending}
              >
                {create.isPending ? "Creating…" : "Create draft BOM"}
              </Button>
            </div>
          </form>
        </FormDialog>

        <Panel
          flush
          actions={
            <SearchFilterToolbar
              search={
                <Input
                  placeholder="Search BOM or product"
                  value={search}
                  onChange={event => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              }
              filters={
                <SelectField
                  aria-label="Filter by status"
                  className="w-full md:w-44"
                  value={status}
                  onChange={event => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PENDING_APPROVAL">Pending approval</option>
                  <option value="ACTIVE">Active</option>
                  <option value="OBSOLETE">Obsolete</option>
                </SelectField>
              }
            />
          }
        >
          <SimpleTable
            isLoading={isLoading}
            rows={boms}
            keyOf={row => row.id}
            onRowClick={row => router.push(`/bom/${row.id}`)}
            empty="No bills of materials yet. Create one for a product you manufacture."
            columns={[
              {
                header: "BOM",
                cell: row => (
                  <span className="font-mono text-xs text-primary">
                    {row.bomNumber}
                  </span>
                ),
              },
              {
                header: "Builds",
                cell: row => (
                  <div>
                    <p className="font-mono text-xs">{row.product.code}</p>
                    <p className="text-sm">{row.product.name}</p>
                  </div>
                ),
              },
              { header: "Name", cell: row => row.name },
              {
                header: "Version",
                cell: row => (
                  <span>
                    v{row.version}
                    <span className="text-muted-foreground">
                      {row.revision}
                    </span>
                    {row.isDefault && (
                      <span className="ml-2 text-xs font-medium text-primary">
                        default
                      </span>
                    )}
                  </span>
                ),
              },
              {
                header: "Output qty",
                align: "right",
                cell: row => formatQuantity(row.outputQuantity),
              },
              {
                header: "Components",
                align: "right",
                cell: row => row._count?.components ?? 0,
              },
              {
                header: "Rolled-up cost",
                align: "right",
                cell: row =>
                  row.rolledUpCost ? (
                    formatMoney(row.rolledUpCost)
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      not costed
                    </span>
                  ),
              },
              {
                header: "Effective from",
                cell: row => formatDate(row.effectiveFrom),
              },
              {
                header: "Status",
                cell: row => <StatusBadge status={row.status} />,
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
