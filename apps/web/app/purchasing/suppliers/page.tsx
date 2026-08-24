"use client";

import { useState } from "react";
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
import { useSupplierMutations, useSuppliers } from "@/hooks/useSupplyChain";
import { formatPercent } from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { FormDialog } from "@repo/ui/components/ui/form-dialog";

export default function SuppliersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { suppliers, pagination, isLoading, error } = useSuppliers({
    page,
    limit: DEFAULT_PAGE_SIZE,
    search: search || undefined,
    status: status || undefined,
  });
  const { create } = useSupplierMutations();

  const [form, setForm] = useState({
    code: "",
    name: "",
    legalName: "",
    status: "ACTIVE",
    email: "",
    phone: "",
    gstNumber: "",
    city: "",
    state: "",
    paymentTerms: "",
    creditDays: "0",
    leadTimeDays: "0",
    currencyCode: "INR",
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        ...form,
        creditDays: Number(form.creditDays) || 0,
        leadTimeDays: Number(form.leadTimeDays) || 0,
        code: form.code || undefined,
      },
      {
        onSuccess: result => {
          setShowForm(false);
          router.push(
            `/purchasing/suppliers/${(result.data as { id: number }).id}`
          );
        },
      }
    );
  };

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Suppliers"
          subtitle="The companies you buy from, their prices, and how well they deliver."
          actions={
            <Button
              type="button"
              onClick={() => setShowForm(true)}
              className="px-3 whitespace-nowrap"
            >
              New supplier
            </Button>
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={create.error} />

        <FormDialog
          open={showForm}
          onOpenChange={setShowForm}
          title="New supplier"
          description="Leave the code blank to have one generated from the supplier sequence."
        >
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
            <Field label="Code">
              <Input
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
                placeholder="Auto"
              />
            </Field>
            <Field label="Name" className="md:col-span-2">
              <Input
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <SelectField
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On hold</option>
              </SelectField>
            </Field>
            <Field label="Legal name" className="md:col-span-2">
              <Input
                value={form.legalName}
                onChange={e => setForm({ ...form, legalName: e.target.value })}
              />
            </Field>
            <Field label="GST number">
              <Input
                value={form.gstNumber}
                onChange={e => setForm({ ...form, gstNumber: e.target.value })}
              />
            </Field>
            <Field label="Currency">
              <Input
                value={form.currencyCode}
                onChange={e =>
                  setForm({ ...form, currencyCode: e.target.value })
                }
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
              />
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
            <Field label="Payment terms">
              <Input
                value={form.paymentTerms}
                onChange={e =>
                  setForm({ ...form, paymentTerms: e.target.value })
                }
                placeholder="e.g. Net 30"
              />
            </Field>
            <Field label="Credit days">
              <Input
                inputMode="numeric"
                value={form.creditDays}
                onChange={e => setForm({ ...form, creditDays: e.target.value })}
              />
            </Field>
            <Field
              label="Lead time (days)"
              hint="Used to work out when an order from this supplier should arrive"
            >
              <Input
                inputMode="numeric"
                value={form.leadTimeDays}
                onChange={e =>
                  setForm({ ...form, leadTimeDays: e.target.value })
                }
              />
            </Field>
            <div className="md:col-span-4 dialog-form-actions">
              <Button type="submit" disabled={!form.name || create.isPending}>
                {create.isPending ? "Creating…" : "Create supplier"}
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
                  placeholder="Search name, code, GST or email"
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
                  className="w-full md:w-40"
                  value={status}
                  onChange={event => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ON_HOLD">On hold</option>
                  <option value="BLACKLISTED">Blacklisted</option>
                  <option value="INACTIVE">Inactive</option>
                </SelectField>
              }
            />
          }
        >
          <SimpleTable
            isLoading={isLoading}
            rows={suppliers}
            keyOf={row => row.id}
            onRowClick={row => router.push(`/purchasing/suppliers/${row.id}`)}
            rowClassName={row =>
              row.isBlacklisted ? "bg-error-surface/40" : ""
            }
            empty="No suppliers yet. Add your real vendors — nothing is pre-seeded."
            columns={[
              {
                header: "Supplier",
                cell: row => (
                  <div>
                    <p className="font-mono text-xs text-primary">{row.code}</p>
                    <p className="text-sm">{row.name}</p>
                  </div>
                ),
              },
              {
                header: "Location",
                cell: row =>
                  [row.city, row.state].filter(Boolean).join(", ") || "—",
              },
              { header: "GST", cell: row => row.gstNumber ?? "—" },
              { header: "Terms", cell: row => row.paymentTerms ?? "—" },
              {
                header: "Lead time",
                align: "right",
                cell: row => `${row.leadTimeDays}d`,
              },
              {
                header: "Catalogue items",
                align: "right",
                cell: row => row._count?.supplierProducts ?? 0,
              },
              {
                header: "Orders",
                align: "right",
                cell: row => row._count?.purchaseOrders ?? 0,
              },
              {
                header: "Last score",
                align: "right",
                cell: row => {
                  const snapshot = row.performanceSnapshots?.[0];
                  if (!snapshot)
                    return (
                      <span className="text-xs text-muted-foreground">
                        not rated
                      </span>
                    );
                  const score = Number(snapshot.overallScore);
                  return (
                    <span
                      className={`font-semibold ${score >= 85 ? "text-success-foreground" : score >= 70 ? "text-warning-foreground" : "text-error-foreground"}`}
                    >
                      {score.toFixed(1)}
                    </span>
                  );
                },
              },
              {
                header: "On time",
                align: "right",
                cell: row => {
                  const snapshot = row.performanceSnapshots?.[0];
                  return snapshot
                    ? formatPercent(snapshot.onTimeDeliveryRate)
                    : "—";
                },
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
