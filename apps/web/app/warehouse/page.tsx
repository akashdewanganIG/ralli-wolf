"use client";

import { useState } from "react";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { WarehouseImagePicker } from "@/components/supply-chain/WarehouseImagePicker";
import { SearchFilterToolbar } from "@repo/ui/components/ui/toolbar";
import {
  EmptyState,
  ErrorBanner,
  Field,
  PageHeader,
  Pager,
  Panel,
  SelectField,
  SimpleTable,
  StatCard,
  StatusBadge,
  DEFAULT_PAGE_SIZE,
} from "@/components/supply-chain/shared";
import {
  useWarehouseMutations,
  useWarehouses,
  useWmsDashboard,
} from "@/hooks/useSupplyChain";
import { humanizeEnum } from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { FormDialog } from "@repo/ui/components/ui/form-dialog";
import { buttonVariants } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Tag } from "@repo/ui/components/ui/tag";
import { DataTransfer } from "@/components/data-transfer/DataTransfer";

export default function WarehouseManagementPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [warehouseImages, setWarehouseImages] = useState<File[]>([]);

  const { warehouses, pagination, isLoading, error } = useWarehouses({
    page,
    limit: DEFAULT_PAGE_SIZE,
    search: search || undefined,
  });
  const { data: dashboardData } = useWmsDashboard();
  const { create } = useWarehouseMutations();

  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "WAREHOUSE",
    city: "",
    state: "",
    contactName: "",
    contactPhone: "",
    allowNegativeStock: false,
    isDefault: false,
  });

  const dashboard = dashboardData?.data;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate(
      { payload: form, images: warehouseImages },
      {
        onSuccess: result => {
          setShowForm(false);
          setWarehouseImages([]);
          setForm({
            code: "",
            name: "",
            type: "WAREHOUSE",
            city: "",
            state: "",
            contactName: "",
            contactPhone: "",
            allowNegativeStock: false,
            isDefault: false,
          });
          router.push(`/warehouse/${(result.data as { id: number }).id}`);
        },
      }
    );
  };

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Warehouse management"
          subtitle="Your buildings and the storage spaces inside them."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <>
                <Link
                  href="/warehouse/putaway"
                  data-slot="button"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Putaway queue
                </Link>
                <Link
                  href="/warehouse/pick-lists"
                  data-slot="button"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Pick lists
                </Link>
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  data-slot="button"
                  className={cn(buttonVariants({ variant: "default" }))}
                >
                  New warehouse
                </button>
              </>
              <DataTransfer entity="warehouses" />
            </div>
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={create.error} />

        <div className="grid-auto-fit gap-3">
          <StatCard
            label="Open putaway tasks"
            value={dashboard?.openPutawayTasks ?? 0}
            href="/warehouse/putaway"
            tone={dashboard?.openPutawayTasks ? "warning" : "neutral"}
          />
          <StatCard
            label="Open pick lists"
            value={dashboard?.openPickLists ?? 0}
            href="/warehouse/pick-lists"
          />
          <StatCard
            label="Packages awaiting dispatch"
            value={dashboard?.packagesAwaitingDispatch ?? 0}
            href="/warehouse/packages"
          />
          <StatCard
            label="Bin occupancy"
            value={dashboard ? `${dashboard.binOccupancyPercent}%` : "—"}
            hint={
              dashboard
                ? `${dashboard.occupiedBins} of ${dashboard.totalBins} bins in use`
                : undefined
            }
          />
        </div>

        <FormDialog
          open={showForm}
          onOpenChange={setShowForm}
          title="New warehouse"
          description="A warehouse needs at least one zone and bin before it can hold stock."
        >
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-3">
            <Field label="Code" hint="Short unique code, e.g. WH-PUNE">
              <Input
                required
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
              />
            </Field>
            <Field label="Name">
              <Input
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Type">
              <SelectField
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
              >
                {["WAREHOUSE", "PLANT", "STORE", "TRANSIT", "VIRTUAL"].map(
                  type => (
                    <option key={type} value={type}>
                      {humanizeEnum(type)}
                    </option>
                  )
                )}
              </SelectField>
            </Field>
            <Field label="City">
              <Input
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
              />
            </Field>
            <Field label="State">
              <Input
                value={form.state}
                onChange={e => setForm({ ...form, state: e.target.value })}
              />
            </Field>
            <Field label="Contact name">
              <Input
                value={form.contactName}
                onChange={e =>
                  setForm({ ...form, contactName: e.target.value })
                }
              />
            </Field>
            <Field label="Contact phone">
              <Input
                value={form.contactPhone}
                onChange={e =>
                  setForm({ ...form, contactPhone: e.target.value })
                }
              />
            </Field>
            <label className="flex items-center gap-2 pt-4 text-sm">
              <Checkbox
                checked={form.isDefault}
                onCheckedChange={checked =>
                  setForm({ ...form, isDefault: checked })
                }
              />
              Make this the default warehouse
            </label>
            <label className="flex items-center gap-2 pt-4 text-sm">
              <Checkbox
                checked={form.allowNegativeStock}
                onCheckedChange={checked =>
                  setForm({ ...form, allowNegativeStock: checked })
                }
              />
              Allow negative stock
            </label>
            <div className="md:col-span-3">
              <Field
                label="Warehouse images"
                hint="Optional. Add up to 8 photos of the building, loading area, or storage floor."
                composite
              >
                <WarehouseImagePicker
                  files={warehouseImages}
                  onChange={setWarehouseImages}
                  disabled={create.isPending}
                />
              </Field>
            </div>
            <div className="md:col-span-3 dialog-form-actions">
              <Button
                type="submit"
                disabled={create.isPending || !form.code || !form.name}
              >
                {create.isPending ? "Creating…" : "Create warehouse"}
              </Button>
            </div>
          </form>
        </FormDialog>

        <Panel
          title="Warehouses"
          flush
          actions={
            <SearchFilterToolbar
              search={
                <Input
                  placeholder="Search code, name or city"
                  value={search}
                  onChange={event => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              }
            />
          }
        >
          {!isLoading && warehouses.length === 0 && !search ? (
            <EmptyState
              title="No warehouses yet"
              description="Create your first warehouse. Nothing is set up in advance, so the storage spaces you add here are the ones staff will use when storing and collecting stock."
              action={
                <Button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="px-3 whitespace-nowrap"
                >
                  Create a warehouse
                </Button>
              }
            />
          ) : (
            <>
              <SimpleTable
                isLoading={isLoading}
                rows={warehouses}
                keyOf={row => row.id}
                onRowClick={row => router.push(`/warehouse/${row.id}`)}
                empty="No warehouse matches that search."
                columns={[
                  {
                    header: "Warehouse",
                    cell: row => (
                      <div className="flex items-center gap-3">
                        <div className="size-11 shrink-0 overflow-hidden rounded-lg border bg-surface-subtle">
                          {row.images?.[0]?.url ? (
                            <Image
                              src={row.images[0].url}
                              alt=""
                              width={44}
                              height={44}
                              unoptimized
                              className="size-full object-cover"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-xs font-semibold text-muted-foreground">
                              {row.code.slice(0, 2)}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-mono text-xs text-primary">
                            {row.code}
                          </p>
                          <p className="text-sm">{row.name}</p>
                        </div>
                      </div>
                    ),
                  },
                  {
                    header: "Type",
                    cell: row => (row.type ? <Tag>{row.type}</Tag> : "—"),
                  },
                  {
                    header: "Location",
                    cell: row =>
                      [row.city, row.state].filter(Boolean).join(", ") || "—",
                  },
                  {
                    header: "Zones",
                    align: "right",
                    cell: row => row._count?.zones ?? 0,
                  },
                  {
                    header: "Bins",
                    align: "right",
                    cell: row => row._count?.bins ?? 0,
                  },
                  {
                    header: "Stock slots",
                    align: "right",
                    cell: row => row._count?.stockBalances ?? 0,
                  },
                  {
                    header: "Negative stock",
                    cell: row =>
                      row.allowNegativeStock ? (
                        <span className="text-xs font-medium text-warning-foreground">
                          Allowed
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Blocked
                        </span>
                      ),
                  },
                  {
                    header: "Status",
                    cell: row => (
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          status={row.isActive ? "ACTIVE" : "INACTIVE"}
                        />
                        {row.isDefault && (
                          <span className="text-xs font-medium text-primary">
                            default
                          </span>
                        )}
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
            </>
          )}
        </Panel>
      </PageShell>
    </ProtectedRoute>
  );
}
