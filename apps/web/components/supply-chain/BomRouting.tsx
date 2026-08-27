"use client";

import * as React from "react";
import Link from "next/link";

import { Alert } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Tag } from "@repo/ui/components/ui/tag";

import {
  ErrorBanner,
  Field,
  Panel,
  SimpleTable,
  StatCard,
} from "@/components/supply-chain/shared";
import {
  useBomOperations,
  useBomRoutingMutations,
  useWorkCenters,
} from "@/hooks/useFinance";
import type { BomOperationRow } from "@/lib/api/financeServices";
import { formatMoney } from "@/lib/utils/decimal";

/**
 * Minutes one step needs for a batch. Mirrors the server's own formula
 * (setup once, run per unit) so the preview here matches the schedule that
 * actually gets written.
 */
function stepMinutes(op: BomOperationRow, quantity: number) {
  return Math.ceil(op.setupMinutes + Number(op.runMinutesPerUnit) * quantity);
}

function asHours(minutes: number) {
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}

/**
 * Walks the routing the way the scheduler does: a blocking step pushes the
 * next one out, a non-blocking one runs alongside. Gives total work booked
 * against the centres, and the elapsed span the order will occupy.
 */
function rollUp(operations: BomOperationRow[], quantity: number) {
  let cursor = 0;
  let lastEnd = 0;
  let totalMinutes = 0;
  let cost = 0;

  const rows = operations.map(op => {
    const minutes = stepMinutes(op, quantity);
    const start = cursor;
    const end = start + minutes;
    totalMinutes += minutes;
    cost += (minutes / 60) * Number(op.workCenter.costPerHour ?? 0);
    lastEnd = end;
    if (op.isBlocking) cursor = end;
    return { op, minutes, start, end };
  });

  return { rows, totalMinutes, elapsedMinutes: lastEnd, cost };
}

const BLANK = {
  workCenterId: "",
  name: "",
  sequence: "",
  setupMinutes: "0",
  runMinutesPerUnit: "0",
  isBlocking: true,
};

type Draft = typeof BLANK;

/**
 * The routing editor for one bill of materials.
 *
 * Until a BOM has routing, nothing built from it can be scheduled — the
 * planning board shows those orders as unschedulable. This is where the steps
 * get put on.
 */
export function BomRouting({
  bomId,
  isEditable,
  outputQuantity,
}: {
  bomId: number;
  isEditable: boolean;
  outputQuantity?: string | number;
}) {
  const { data, isLoading, error } = useBomOperations(bomId);
  const { data: workCenterData } = useWorkCenters({ activeOnly: true });
  const { addOperation, updateOperation, removeOperation } =
    useBomRoutingMutations(bomId);

  const operations = React.useMemo(
    () => [...(data?.data ?? [])].sort((a, b) => a.sequence - b.sequence),
    [data]
  );
  const workCenters = workCenterData?.data ?? [];

  const [batch, setBatch] = React.useState(String(outputQuantity ?? 1));
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(BLANK);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [edit, setEdit] = React.useState<Draft>(BLANK);

  const quantity = Math.max(Number(batch) || 0, 0);
  const { rows, totalMinutes, elapsedMinutes, cost } = rollUp(
    operations,
    quantity
  );

  const setDraftField = (key: keyof Draft, value: string | boolean) =>
    setDraft(prev => ({ ...prev, [key]: value }));
  const setEditField = (key: keyof Draft, value: string | boolean) =>
    setEdit(prev => ({ ...prev, [key]: value }));

  /** Sequence is left blank on purpose — the server appends in tens. */
  const submitDraft = () => {
    addOperation.mutate(
      {
        workCenterId: Number(draft.workCenterId),
        name: draft.name.trim(),
        ...(draft.sequence.trim() ? { sequence: Number(draft.sequence) } : {}),
        setupMinutes: Number(draft.setupMinutes) || 0,
        runMinutesPerUnit: draft.runMinutesPerUnit || "0",
        isBlocking: draft.isBlocking,
      },
      {
        onSuccess: () => {
          setDraft(BLANK);
          setAdding(false);
        },
      }
    );
  };

  const startEditing = (op: BomOperationRow) => {
    setEditingId(op.id);
    setEdit({
      workCenterId: String(op.workCenter.id),
      name: op.name,
      sequence: String(op.sequence),
      setupMinutes: String(op.setupMinutes),
      runMinutesPerUnit: String(op.runMinutesPerUnit),
      isBlocking: op.isBlocking,
    });
  };

  const submitEdit = () => {
    if (editingId === null) return;
    updateOperation.mutate(
      {
        operationId: editingId,
        payload: {
          workCenterId: Number(edit.workCenterId),
          name: edit.name.trim(),
          sequence: Number(edit.sequence),
          setupMinutes: Number(edit.setupMinutes) || 0,
          runMinutesPerUnit: edit.runMinutesPerUnit || "0",
          isBlocking: edit.isBlocking,
        },
      },
      { onSuccess: () => setEditingId(null) }
    );
  };

  const draftValid = draft.workCenterId !== "" && draft.name.trim() !== "";
  const editValid = edit.workCenterId !== "" && edit.name.trim() !== "";

  return (
    <>
      <ErrorBanner error={error} />

      {!isLoading && operations.length === 0 && (
        <Alert tone="warning" title="No routing on this BOM">
          Production orders built from this BOM cannot be scheduled until it has
          at least one step. Add the operations below, then schedule the order
          from the{" "}
          <Link
            href="/planning"
            className="font-medium underline underline-offset-2"
          >
            planning board
          </Link>
          .
        </Alert>
      )}

      {workCenters.length === 0 && (
        <Alert tone="info" title="No work centres yet">
          A step has to happen somewhere.{" "}
          <Link
            href="/planning/work-centers"
            className="font-medium underline underline-offset-2"
          >
            Add a work centre
          </Link>{" "}
          first, then come back and build the routing.
        </Alert>
      )}

      <div className="grid-auto-fit gap-3">
        <StatCard
          label="Steps"
          value={isLoading ? "—" : String(operations.length)}
          hint="Operations in this routing"
        />
        <StatCard
          label="Work booked"
          value={isLoading ? "—" : asHours(totalMinutes)}
          hint={`Machine time for ${quantity || 0} unit(s)`}
          tone="info"
        />
        <StatCard
          label="Elapsed span"
          value={isLoading ? "—" : asHours(elapsedMinutes)}
          hint="Start to finish, parallel steps overlapped"
          tone="neutral"
        />
        <StatCard
          label="Routing cost"
          value={isLoading ? "—" : formatMoney(cost)}
          hint="Minutes × each centre's hourly rate"
          tone={cost > 0 ? "positive" : "neutral"}
        />
      </div>

      <Panel
        flush
        title="Routing"
        description={
          isEditable
            ? "The steps a build goes through, in order. A blocking step has to finish before the next one starts; a non-blocking one runs alongside it."
            : "This routing is locked so orders already scheduled against it stay reproducible. Make a new revision to change it."
        }
        actions={
          <div className="flex items-center gap-2">
            <label className="text-xs whitespace-nowrap text-muted-foreground">
              Batch size
            </label>
            <Input
              inputMode="decimal"
              value={batch}
              onChange={e => setBatch(e.target.value)}
              className="h-8 w-20"
            />
            {isEditable && (
              <Button
                type="button"
                size="sm"
                variant={adding ? "outline" : "default"}
                disabled={workCenters.length === 0}
                onClick={() => setAdding(v => !v)}
              >
                {adding ? "Cancel" : "Add step"}
              </Button>
            )}
          </div>
        }
      >
        <SimpleTable
          isLoading={isLoading}
          rows={rows}
          keyOf={row => row.op.id}
          empty={
            error
              ? "The routing could not be loaded."
              : "No steps yet. Add the first operation to make this BOM schedulable."
          }
          columns={[
            {
              header: "Step",
              align: "right",
              cell: row => row.op.sequence,
            },
            {
              header: "Operation",
              cell: row => (
                <div>
                  <p className="text-sm font-medium">{row.op.name}</p>
                  {row.op.description && (
                    <p className="text-xs text-muted-foreground">
                      {row.op.description}
                    </p>
                  )}
                  {!row.op.isBlocking && (
                    <Tag tone="progress" className="mt-0.5">
                      runs alongside
                    </Tag>
                  )}
                </div>
              ),
            },
            {
              header: "Work centre",
              cell: row => (
                <div>
                  <span className="font-mono text-xs">
                    {row.op.workCenter.code}
                  </span>
                  <p className="text-sm">{row.op.workCenter.name}</p>
                </div>
              ),
            },
            {
              header: "Setup",
              align: "right",
              cell: row => `${row.op.setupMinutes}m`,
            },
            {
              header: "Run / unit",
              align: "right",
              cell: row => `${Number(row.op.runMinutesPerUnit)}m`,
            },
            {
              header: "This batch",
              align: "right",
              cell: row => (
                <span className="font-medium text-foreground">
                  {row.minutes}m
                </span>
              ),
            },
            {
              header: "Starts at",
              align: "right",
              cell: row => (
                <span className="text-xs text-muted-foreground">
                  +{asHours(row.start)}
                </span>
              ),
            },
            {
              header: "Cost",
              align: "right",
              cell: row =>
                formatMoney(
                  (row.minutes / 60) *
                    Number(row.op.workCenter.costPerHour ?? 0)
                ),
            },
            {
              header: "",
              align: "right",
              cell: row =>
                isEditable ? (
                  <div className="flex justify-end gap-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() =>
                        editingId === row.op.id
                          ? setEditingId(null)
                          : startEditing(row.op)
                      }
                      className="text-xs text-primary hover:text-info"
                    >
                      {editingId === row.op.id ? "cancel" : "edit"}
                    </button>
                    <button
                      type="button"
                      disabled={removeOperation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove step ${row.op.sequence} — ${row.op.name}?`
                          )
                        ) {
                          removeOperation.mutate(row.op.id);
                        }
                      }}
                      className="text-xs text-error-foreground hover:text-info"
                    >
                      remove
                    </button>
                  </div>
                ) : null,
            },
          ]}
        />

        {editingId !== null && isEditable && (
          <form
            className="mt-4 grid gap-3 rounded-md border bg-muted/30 p-4 md:grid-cols-6"
            onSubmit={event => {
              event.preventDefault();
              if (editValid) submitEdit();
            }}
          >
            <Field label="Step number" hint="Order it runs in">
              <Input
                inputMode="numeric"
                value={edit.sequence}
                onChange={e => setEditField("sequence", e.target.value)}
              />
            </Field>
            <Field label="Operation" className="md:col-span-2">
              <Input
                value={edit.name}
                onChange={e => setEditField("name", e.target.value)}
              />
            </Field>
            <Field label="Work centre" className="md:col-span-2" composite>
              <Select
                value={edit.workCenterId}
                onValueChange={v => setEditField("workCenterId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a work centre" />
                </SelectTrigger>
                <SelectContent>
                  {workCenters.map(wc => (
                    <SelectItem key={wc.id} value={String(wc.id)}>
                      {wc.code} — {wc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Setup minutes" hint="Once per batch">
              <Input
                inputMode="numeric"
                value={edit.setupMinutes}
                onChange={e => setEditField("setupMinutes", e.target.value)}
              />
            </Field>
            <Field label="Run minutes per unit">
              <Input
                inputMode="decimal"
                value={edit.runMinutesPerUnit}
                onChange={e =>
                  setEditField("runMinutesPerUnit", e.target.value)
                }
              />
            </Field>
            <div className="flex items-center md:col-span-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={edit.isBlocking}
                  onCheckedChange={checked =>
                    setEditField("isBlocking", Boolean(checked))
                  }
                />
                Must finish before the next step starts
              </label>
            </div>
            <div className="flex gap-2 md:col-span-6">
              <Button
                type="submit"
                disabled={!editValid || updateOperation.isPending}
              >
                {updateOperation.isPending ? "Saving…" : "Save step"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Panel>

      {adding && isEditable && (
        <Panel
          title="Add a step"
          description="Say where the work happens and how long it takes. Setup is charged once per batch; run time is charged per unit."
        >
          <form
            className="grid gap-3 md:grid-cols-6"
            onSubmit={event => {
              event.preventDefault();
              if (draftValid) submitDraft();
            }}
          >
            <Field label="Step number" hint="Leave blank to add to the end">
              <Input
                inputMode="numeric"
                value={draft.sequence}
                onChange={e => setDraftField("sequence", e.target.value)}
                placeholder="auto"
              />
            </Field>
            <Field label="Operation" className="md:col-span-2">
              <Input
                value={draft.name}
                onChange={e => setDraftField("name", e.target.value)}
                placeholder="Cut to length"
              />
            </Field>
            <Field label="Work centre" className="md:col-span-2" composite>
              <Select
                value={draft.workCenterId}
                onValueChange={v => setDraftField("workCenterId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a work centre" />
                </SelectTrigger>
                <SelectContent>
                  {workCenters.map(wc => (
                    <SelectItem key={wc.id} value={String(wc.id)}>
                      {wc.code} — {wc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Setup minutes" hint="Once per batch">
              <Input
                inputMode="numeric"
                value={draft.setupMinutes}
                onChange={e => setDraftField("setupMinutes", e.target.value)}
              />
            </Field>
            <Field
              label="Run minutes per unit"
              hint="Multiplied by the batch size"
            >
              <Input
                inputMode="decimal"
                value={draft.runMinutesPerUnit}
                onChange={e =>
                  setDraftField("runMinutesPerUnit", e.target.value)
                }
              />
            </Field>
            <div className="flex items-center md:col-span-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.isBlocking}
                  onCheckedChange={checked =>
                    setDraftField("isBlocking", Boolean(checked))
                  }
                />
                Must finish before the next step starts
              </label>
            </div>
            <div className="flex gap-2 md:col-span-6">
              <Button
                type="submit"
                disabled={!draftValid || addOperation.isPending}
              >
                {addOperation.isPending ? "Adding…" : "Add step"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdding(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Panel>
      )}
    </>
  );
}
