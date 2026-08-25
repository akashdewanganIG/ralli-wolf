"use client";

import * as React from "react";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Tag } from "@repo/ui/components/ui/tag";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  ErrorBanner,
  Field,
  PageHeader,
  Panel,
  SimpleTable,
  StatCard,
} from "@/components/supply-chain/shared";
import { usePlanningMutations, useWorkCenters } from "@/hooks/useFinance";
import { useWarehouses } from "@/hooks/useSupplyChain";
import { formatMoney } from "@/lib/utils/decimal";
import { DataTransfer } from "@/components/data-transfer/DataTransfer";

const TYPES = [
  { value: "MACHINE", label: "Machine" },
  { value: "ASSEMBLY_LINE", label: "Assembly line" },
  { value: "WORKSTATION", label: "Workstation" },
  { value: "INSPECTION", label: "Inspection" },
  { value: "PACKING", label: "Packing" },
];

const BLANK = {
  code: "",
  name: "",
  type: "MACHINE",
  warehouseId: "",
  capacityMinutesPerDay: "480",
  efficiencyPercent: "100",
  costPerHour: "0",
  parallelCapacity: "1",
};

export default function WorkCentersPage() {
  const { data, isLoading, error } = useWorkCenters();
  const unknown = isLoading || Boolean(error);
  const { warehouses } = useWarehouses({ limit: 100, isActive: true });
  const { createWorkCenter } = usePlanningMutations();
  const [form, setForm] = React.useState(BLANK);
  const [adding, setAdding] = React.useState(false);

  const centres = data?.data ?? [];
  const totalHours =
    Math.round(
      (centres.reduce((sum, c) => sum + c.effectiveMinutesPerDay, 0) / 60) * 10
    ) / 10;

  const set = (key: keyof typeof BLANK, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const submit = () => {
    createWorkCenter.mutate(
      {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        type: form.type,
        warehouseId: Number(form.warehouseId),
        capacityMinutesPerDay: Number(form.capacityMinutesPerDay),
        efficiencyPercent: form.efficiencyPercent,
        costPerHour: form.costPerHour,
        parallelCapacity: Number(form.parallelCapacity),
      },
      {
        onSuccess: () => {
          setForm(BLANK);
          setAdding(false);
        },
      }
    );
  };

  const canSubmit =
    form.code.trim() !== "" &&
    form.name.trim() !== "" &&
    form.warehouseId !== "";

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Work centres"
          subtitle="The machines, lines and benches where work actually gets done. Every production step is assigned to one of these."
          actions={<DataTransfer entity="work-centers" />}
        />

        <ErrorBanner error={error} />

        <div className="grid-auto-fit gap-3">
          <StatCard
            label="Work centres"
            value={unknown ? "—" : String(centres.length)}
            hint="Places work can be scheduled"
            tone="neutral"
          />
          <StatCard
            label="Hours a day, all told"
            value={unknown ? "—" : `${totalHours}h`}
            hint="After efficiency and parallel stations"
            tone="info"
          />
          <StatCard
            label="Currently booked"
            value={
              unknown
                ? "—"
                : String(centres.reduce((s, c) => s + c._count.scheduled, 0))
            }
            hint="Production steps waiting on them"
            tone="positive"
          />
        </div>

        <Panel
          flush
          title="All work centres"
          description="Capacity is the real hours a centre gives you each day, after its efficiency and how many jobs it can run side by side."
          actions={
            <Button
              type="button"
              size="sm"
              variant={adding ? "outline" : "default"}
              onClick={() => setAdding(v => !v)}
            >
              {adding ? "Cancel" : "Add work centre"}
            </Button>
          }
        >
          <SimpleTable
            isLoading={isLoading}
            rows={centres}
            keyOf={row => row.id}
            empty={
              error
                ? "Work centres could not be loaded."
                : "No work centres yet. Add one to start scheduling production."
            }
            columns={[
              { header: "Code", cell: row => row.code },
              { header: "Name", cell: row => row.name },
              {
                header: "Type",
                cell: row => (
                  <Tag>
                    {TYPES.find(t => t.value === row.type)?.label ?? row.type}
                  </Tag>
                ),
              },
              { header: "Plant", cell: row => row.warehouse.code },
              {
                header: "Shift",
                align: "right",
                cell: row =>
                  `${Math.round((row.capacityMinutesPerDay / 60) * 10) / 10}h`,
              },
              {
                header: "Efficiency",
                align: "right",
                cell: row => `${Number(row.efficiencyPercent)}%`,
              },
              {
                header: "In parallel",
                align: "right",
                cell: row => `×${row.parallelCapacity}`,
              },
              {
                header: "Real capacity",
                align: "right",
                cell: row => (
                  <span className="font-medium text-foreground">
                    {Math.round((row.effectiveMinutesPerDay / 60) * 10) / 10}h
                  </span>
                ),
              },
              {
                header: "Cost / hour",
                align: "right",
                cell: row => formatMoney(row.costPerHour),
              },
              {
                header: "Booked",
                align: "right",
                cell: row => String(row._count.scheduled),
              },
              {
                header: "",
                align: "right",
                cell: row =>
                  row.isActive ? (
                    <Tag tone="active">Active</Tag>
                  ) : (
                    <Tag tone="neutral">Inactive</Tag>
                  ),
              },
            ]}
          />
        </Panel>

        {adding && (
          <Panel
            title="Add a work centre"
            description="Give it a short code, say where it sits, and how long a shift it runs."
          >
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Code" hint="Short and unique, e.g. WC-CNC">
                  <Input
                    value={form.code}
                    onChange={e => set("code", e.target.value)}
                    placeholder="WC-CNC"
                  />
                </Field>
                <Field label="Name">
                  <Input
                    value={form.name}
                    onChange={e => set("name", e.target.value)}
                    placeholder="CNC Machining Cell"
                  />
                </Field>
                <Field label="Type">
                  <Select value={form.type} onValueChange={v => set("type", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Plant" hint="Which site it stands in">
                  <Select
                    value={form.warehouseId}
                    onValueChange={v => set("warehouseId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a plant" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map(w => (
                        <SelectItem key={w.id} value={String(w.id)}>
                          {w.code} — {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="Minutes a day"
                  hint="Length of one shift, 480 = 8 hours"
                >
                  <Input
                    inputMode="numeric"
                    value={form.capacityMinutesPerDay}
                    onChange={e => set("capacityMinutesPerDay", e.target.value)}
                  />
                </Field>
                <Field
                  label="Efficiency %"
                  hint="Realistic output vs. the ideal"
                >
                  <Input
                    inputMode="decimal"
                    value={form.efficiencyPercent}
                    onChange={e => set("efficiencyPercent", e.target.value)}
                  />
                </Field>
                <Field
                  label="Jobs in parallel"
                  hint="How many at once, e.g. 3 benches"
                >
                  <Input
                    inputMode="numeric"
                    value={form.parallelCapacity}
                    onChange={e => set("parallelCapacity", e.target.value)}
                  />
                </Field>
                <Field
                  label="Cost per hour"
                  hint="Used to cost a production run"
                >
                  <Input
                    inputMode="decimal"
                    value={form.costPerHour}
                    onChange={e => set("costPerHour", e.target.value)}
                  />
                </Field>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={!canSubmit || createWorkCenter.isPending}
                  onClick={submit}
                >
                  {createWorkCenter.isPending
                    ? "Creating…"
                    : "Create work centre"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdding(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Panel>
        )}
      </PageShell>
    </ProtectedRoute>
  );
}
