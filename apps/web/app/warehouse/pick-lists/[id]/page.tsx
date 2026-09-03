"use client";

import { useState } from "react";
import { CONTROL_HEIGHT } from "@repo/ui/components/ui/form-control";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Checkbox } from "@repo/ui";
import { ProtectedRoute } from "@/components/protected-route";
import {
  DetailRow,
  ErrorBanner,
  ErrorBanner as Banner,
  PageHeader,
  Panel,
  SimpleTable,
  StatCard,
  StatusBadge,
} from "@/components/supply-chain/shared";
import { usePickList, useWmsMutations } from "@/hooks/use-supply-chain";
import {
  formatDate,
  formatDateTime,
  formatQuantity,
  humanizeEnum,
} from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { buttonVariants } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

export default function PickListDetailPage() {
  const params = useParams<{ id: string }>();
  const pickListId = Number(params.id);
  const { data, isLoading, error } = usePickList(pickListId);
  const { releasePickList, cancelPickList, confirmPick, createPackage, ship } =
    useWmsMutations();

  const [pickDraft, setPickDraft] = useState<Record<number, string>>({});
  const [packDraft, setPackDraft] = useState<Record<number, string>>({});
  const [selectedPackageIds, setSelectedPackageIds] = useState<Set<number>>(
    new Set()
  );
  const [packMeta, setPackMeta] = useState({
    grossWeightKg: "",
    carrier: "",
    trackingNumber: "",
  });

  const pickList = data?.data;
  const tasks = pickList?.tasks ?? [];
  const packages = pickList?.packages ?? [];

  const totalRequested = tasks.reduce(
    (acc, task) => acc + Number(task.requestedQuantity),
    0
  );
  const totalPicked = tasks.reduce(
    (acc, task) => acc + Number(task.pickedQuantity),
    0
  );
  const openTasks = tasks.filter(
    task => task.status !== "COMPLETED" && task.status !== "CANCELLED"
  ).length;

  const packLines = Object.entries(packDraft)
    .filter(([, value]) => value !== "" && Number(value) > 0)
    .map(([pickTaskId, quantity]) => ({
      pickTaskId: Number(pickTaskId),
      quantity,
    }));

  const unshippedPackages = packages.filter(entry => entry.status === "PACKED");
  const selectedUnshippedPackageIds = unshippedPackages
    .map(entry => entry.id)
    .filter(id => selectedPackageIds.has(id));
  const allUnshippedSelected =
    unshippedPackages.length > 0 &&
    selectedUnshippedPackageIds.length === unshippedPackages.length;

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title={
            pickList ? `Pick list ${pickList.pickListNumber}` : "Pick list"
          }
          subtitle={
            pickList
              ? `${pickList.warehouse.code} · ${pickList.strategy} strategy · for ${pickList.referenceNumber ?? humanizeEnum(pickList.referenceType)}`
              : undefined
          }
          breadcrumb={[
            { label: "Warehouse management", href: "/warehouse" },
            { label: "Pick lists", href: "/warehouse/pick-lists" },
            { label: pickList?.pickListNumber ?? String(pickListId) },
          ]}
          actions={
            pickList && (
              <div className="flex items-center gap-2">
                <StatusBadge status={pickList.status} />
                {pickList.status === "DRAFT" && (
                  <Button
                    type="button"
                    onClick={() => releasePickList.mutate(pickListId)}
                    disabled={releasePickList.isPending}
                    className="px-3 whitespace-nowrap"
                  >
                    Release to the floor
                  </Button>
                )}
                {pickList.status !== "SHIPPED" &&
                  pickList.status !== "CANCELLED" && (
                    <Button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Cancel this pick list? Any reserved stock is released back to free stock."
                          )
                        ) {
                          cancelPickList.mutate(pickListId);
                        }
                      }}
                      disabled={cancelPickList.isPending}
                      variant="outline"
                      className="px-3 whitespace-nowrap"
                    >
                      Cancel
                    </Button>
                  )}
              </div>
            )
          }
        />

        <ErrorBanner error={error} />
        <Banner error={releasePickList.error} />
        <Banner error={cancelPickList.error} />
        <Banner error={confirmPick.error} />
        <Banner error={createPackage.error} />
        <Banner error={ship.error} />

        <div className="grid-auto-fit gap-3">
          <StatCard label="Lines to pick" value={tasks.length} />
          <StatCard label="Requested" value={formatQuantity(totalRequested)} />
          <StatCard
            label="Picked"
            value={formatQuantity(totalPicked)}
            tone={openTasks === 0 && tasks.length > 0 ? "positive" : "neutral"}
            hint={`${openTasks} line(s) still open`}
          />
          <StatCard
            label="Packages"
            value={packages.length}
            hint={`${unshippedPackages.length} awaiting dispatch`}
          />
        </div>

        {pickList && (
          <Panel title="Pick list details">
            <div className="grid-auto-fit gap-4">
              <DetailRow
                label="Warehouse"
                value={`${pickList.warehouse.code} — ${pickList.warehouse.name}`}
              />
              <DetailRow
                label="Reference"
                value={
                  pickList.referenceNumber ??
                  humanizeEnum(pickList.referenceType)
                }
              />
              <DetailRow
                label="Released"
                value={formatDateTime(pickList.releasedAt)}
              />
              <DetailRow
                label="Completed"
                value={formatDateTime(pickList.completedAt)}
              />
              <DetailRow
                label="Assigned to"
                value={
                  pickList.assignedTo
                    ? `${pickList.assignedTo.firstName ?? ""} ${pickList.assignedTo.lastName ?? ""}`.trim()
                    : "Unassigned"
                }
              />
              {pickList.notes && (
                <DetailRow label="Notes" value={pickList.notes} />
              )}
            </div>
          </Panel>
        )}

        <Panel
          flush
          title="Pick tasks"
          description="The items to collect, listed in the order you walk the warehouse. Leave the amount blank to confirm the whole line."
        >
          <SimpleTable
            isLoading={isLoading}
            rows={tasks}
            keyOf={row => row.id}
            empty="This pick list has no tasks."
            rowClassName={row =>
              row.status === "COMPLETED" ? "bg-success-surface/30" : ""
            }
            columns={[
              { header: "#", align: "right", cell: row => row.sequence },
              {
                header: "Bin",
                cell: row => (
                  <div>
                    <span className="font-mono text-xs">{row.bin.code}</span>
                    <p className="text-xs text-muted-foreground">
                      {[row.bin.aisle, row.bin.rack, row.bin.level]
                        .filter(Boolean)
                        .join(" / ")}
                    </p>
                  </div>
                ),
              },
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
                    {row.lot.batchNumber && (
                      <p className="text-xs text-muted-foreground">
                        Batch {row.lot.batchNumber}
                      </p>
                    )}
                    {row.lot.serialNumber && (
                      <p className="text-xs text-muted-foreground">
                        S/N {row.lot.serialNumber}
                      </p>
                    )}
                    {row.lot.expiryDate && (
                      <p className="text-xs text-warning-foreground">
                        exp {formatDate(row.lot.expiryDate)}
                      </p>
                    )}
                  </div>
                ),
              },
              {
                header: "Requested",
                align: "right",
                cell: row => formatQuantity(row.requestedQuantity),
              },
              {
                header: "Picked",
                align: "right",
                cell: row => formatQuantity(row.pickedQuantity),
              },
              {
                header: "Status",
                cell: row => <StatusBadge status={row.status} />,
              },
              {
                header: "Confirm",
                align: "right",
                cell: row =>
                  row.status === "COMPLETED" ||
                  row.status === "CANCELLED" ||
                  pickList?.status === "DRAFT" ? (
                    <span className="text-xs text-muted-foreground">
                      {pickList?.status === "DRAFT" ? "release first" : "done"}
                    </span>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <Input
                        className="w-24 text-right"
                        inputMode="decimal"
                        placeholder="all"
                        value={pickDraft[row.id] ?? ""}
                        onChange={event =>
                          setPickDraft(current => ({
                            ...current,
                            [row.id]: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        disabled={confirmPick.isPending}
                        onClick={() =>
                          confirmPick.mutate(
                            {
                              pickTaskId: row.id,
                              payload: pickDraft[row.id]
                                ? { quantity: pickDraft[row.id] }
                                : undefined,
                            },
                            {
                              onSuccess: () =>
                                setPickDraft(current => ({
                                  ...current,
                                  [row.id]: "",
                                })),
                            }
                          )
                        }
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                      >
                        Pick
                      </button>
                    </div>
                  ),
              },
            ]}
          />
        </Panel>

        {totalPicked > 0 &&
          pickList?.status !== "SHIPPED" &&
          pickList?.status !== "CANCELLED" && (
            <Panel
              title="Pack picked goods"
              description="Put collected items into a package. You can only pack what has already been picked."
            >
              <form
                onSubmit={event => {
                  event.preventDefault();
                  if (packLines.length === 0) return;
                  createPackage.mutate(
                    {
                      pickListId,
                      payload: {
                        lines: packLines,
                        grossWeightKg: packMeta.grossWeightKg || undefined,
                        carrier: packMeta.carrier || undefined,
                        trackingNumber: packMeta.trackingNumber || undefined,
                      },
                    },
                    {
                      onSuccess: () => {
                        setPackDraft({});
                        setPackMeta({
                          grossWeightKg: "",
                          carrier: "",
                          trackingNumber: "",
                        });
                      },
                    }
                  );
                }}
                className="space-y-4"
              >
                <SimpleTable
                  rows={tasks.filter(task => Number(task.pickedQuantity) > 0)}
                  keyOf={row => row.id}
                  empty="Nothing picked yet."
                  columns={[
                    {
                      header: "Item",
                      cell: row => `${row.product.code} — ${row.product.name}`,
                    },
                    {
                      header: "Lot",
                      cell: row => (
                        <span className="font-mono text-xs">
                          {row.lot.lotNumber}
                        </span>
                      ),
                    },
                    {
                      header: "Picked",
                      align: "right",
                      cell: row => formatQuantity(row.pickedQuantity),
                    },
                    {
                      header: "Pack quantity",
                      align: "right",
                      cell: row => (
                        <Input
                          className="w-24 text-right"
                          inputMode="decimal"
                          placeholder="0"
                          value={packDraft[row.id] ?? ""}
                          onChange={event =>
                            setPackDraft(current => ({
                              ...current,
                              [row.id]: event.target.value,
                            }))
                          }
                        />
                      ),
                    },
                  ]}
                />

                <div className="grid gap-4 md:grid-cols-4">
                  <Input
                    placeholder="Gross weight (kg)"
                    inputMode="decimal"
                    value={packMeta.grossWeightKg}
                    onChange={event =>
                      setPackMeta({
                        ...packMeta,
                        grossWeightKg: event.target.value,
                      })
                    }
                  />
                  <Input
                    placeholder="Carrier"
                    value={packMeta.carrier}
                    onChange={event =>
                      setPackMeta({ ...packMeta, carrier: event.target.value })
                    }
                  />
                  <Input
                    placeholder="Tracking number"
                    value={packMeta.trackingNumber}
                    onChange={event =>
                      setPackMeta({
                        ...packMeta,
                        trackingNumber: event.target.value,
                      })
                    }
                  />
                  <Button
                    type="submit"
                    disabled={packLines.length === 0 || createPackage.isPending}
                  >
                    {createPackage.isPending
                      ? "Packing…"
                      : `Pack ${packLines.length} line(s)`}
                  </Button>
                </div>
              </form>
            </Panel>
          )}

        {packages.length > 0 && (
          <Panel
            flush
            title="Packages"
            actions={
              unshippedPackages.length > 0 && (
                <>
                  <label
                    className={`inline-flex ${CONTROL_HEIGHT.md} cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-input bg-surface px-3 text-sm font-medium text-foreground`}
                  >
                    <Checkbox
                      checked={
                        allUnshippedSelected
                          ? true
                          : selectedUnshippedPackageIds.length > 0
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={checked =>
                        setSelectedPackageIds(previous => {
                          const next = new Set(previous);
                          unshippedPackages.forEach(entry => {
                            if (checked === true) next.add(entry.id);
                            else next.delete(entry.id);
                          });
                          return next;
                        })
                      }
                    />
                    Select packages
                  </label>
                  <button
                    type="button"
                    disabled={
                      ship.isPending || selectedUnshippedPackageIds.length === 0
                    }
                    onClick={() =>
                      ship.mutate(
                        {
                          pickListId,
                          packageIds: selectedUnshippedPackageIds,
                        },
                        {
                          onSuccess: () => setSelectedPackageIds(new Set()),
                        }
                      )
                    }
                    data-slot="button"
                    className={cn(buttonVariants({ variant: "default" }))}
                  >
                    {ship.isPending
                      ? "Dispatching…"
                      : `Dispatch selected (${selectedUnshippedPackageIds.length})`}
                  </button>
                </>
              )
            }
          >
            <SimpleTable
              rows={packages}
              keyOf={row => row.id}
              columns={[
                {
                  header: "Select",
                  width: "5rem",
                  align: "center",
                  cell: row => (
                    <Checkbox
                      aria-label={`Select package ${row.packageNumber}`}
                      disabled={row.status !== "PACKED" || ship.isPending}
                      checked={selectedPackageIds.has(row.id)}
                      onCheckedChange={checked =>
                        setSelectedPackageIds(previous => {
                          const next = new Set(previous);
                          if (checked === true) next.add(row.id);
                          else next.delete(row.id);
                          return next;
                        })
                      }
                    />
                  ),
                },
                {
                  header: "Package",
                  cell: row => (
                    <span className="font-mono text-xs">
                      {row.packageNumber}
                    </span>
                  ),
                },
                {
                  header: "Status",
                  cell: row => <StatusBadge status={row.status} />,
                },
                {
                  header: "Lines",
                  align: "right",
                  cell: row => row.lines?.length ?? 0,
                },
                {
                  header: "Weight",
                  align: "right",
                  cell: row =>
                    row.grossWeightKg
                      ? `${formatQuantity(row.grossWeightKg)} kg`
                      : "—",
                },
                { header: "Carrier", cell: row => row.carrier ?? "—" },
                { header: "Tracking", cell: row => row.trackingNumber ?? "—" },
                { header: "Pallet", cell: row => row.pallet?.code ?? "—" },
                { header: "Packed", cell: row => formatDateTime(row.packedAt) },
                {
                  header: "Shipped",
                  cell: row => formatDateTime(row.shippedAt),
                },
              ]}
            />
          </Panel>
        )}
      </PageShell>
    </ProtectedRoute>
  );
}
