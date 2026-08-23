"use client";

import { useState } from "react";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import Link from "next/link";
import { Alert } from "@repo/ui/components/ui/alert";
import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  DetailRow,
  ErrorBanner,
  Field,
  PageHeader,
  Panel,
  SimpleTable,
  StatCard,
  StatusBadge,
  TabBar,
} from "@/components/supply-chain/shared";
import {
  ProductPicker,
  type PickedProduct,
} from "@/components/supply-chain/ProductPicker";
import {
  useBom,
  useBomExplosion,
  useBomHistory,
  useBomMutations,
} from "@/hooks/useSupplyChain";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
  humanizeEnum,
} from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { Tag } from "@repo/ui/components/ui/tag";

export default function BomDetailPage() {
  const params = useParams<{ id: string }>();
  const bomId = Number(params.id);
  const [tab, setTab] = useState<
    "structure" | "explosion" | "costing" | "history"
  >("structure");
  const [explodeQuantity, setExplodeQuantity] = useState("1");

  const { data, isLoading, error } = useBom(bomId);
  const { data: explosionData, isLoading: explosionLoading } = useBomExplosion(
    bomId,
    explodeQuantity,
    tab === "explosion"
  );
  const { entries: historyEntries, isLoading: historyLoading } =
    useBomHistory(bomId);
  const {
    addComponent,
    removeComponent,
    updateComponent,
    addSubstitute,
    removeSubstitute,
    changeStatus,
    costRollup,
    revise,
  } = useBomMutations();

  const bom = data?.data;
  const components = bom?.components ?? [];
  const isEditable = bom?.status === "DRAFT";

  const [newComponent, setNewComponent] = useState<{
    product: PickedProduct | null;
    quantity: string;
    scrapPercent: string;
    isPhantom: boolean;
    isOptional: boolean;
  }>({
    product: null,
    quantity: "",
    scrapPercent: "0",
    isPhantom: false,
    isOptional: false,
  });
  const [substituteFor, setSubstituteFor] = useState<number | null>(null);
  const [newSubstitute, setNewSubstitute] = useState<{
    product: PickedProduct | null;
    priority: string;
    conversionFactor: string;
  }>({
    product: null,
    priority: "1",
    conversionFactor: "1",
  });

  const componentCost = components.reduce(
    (acc, component) =>
      acc +
      Number(component.quantity) *
        Number(component.componentProduct.standardCost ?? 0),
    0
  );

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title={bom ? `${bom.bomNumber} — ${bom.name}` : "Bill of materials"}
          subtitle={
            bom
              ? `Builds ${bom.product.code} — ${bom.product.name} · version ${bom.version}${bom.revision} · ${formatQuantity(bom.outputQuantity)} unit(s) per run`
              : undefined
          }
          breadcrumb={[
            { label: "Bills of materials", href: "/bom" },
            { label: bom?.bomNumber ?? String(bomId) },
          ]}
          actions={
            bom && (
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={bom.status} />
                {bom.status === "DRAFT" && (
                  <Button
                    type="button"
                    disabled={changeStatus.isPending || components.length === 0}
                    onClick={() =>
                      changeStatus.mutate({ id: bomId, status: "ACTIVE" })
                    }
                    className="px-3 whitespace-nowrap"
                    title={
                      components.length === 0
                        ? "Add at least one component before activating"
                        : undefined
                    }
                  >
                    Activate
                  </Button>
                )}
                {bom.status === "ACTIVE" && (
                  <>
                    <Button
                      type="button"
                      disabled={revise.isPending}
                      onClick={() => {
                        const reason =
                          window.prompt(
                            "Why is this BOM being revised? (optional)"
                          ) ?? undefined;
                        revise.mutate({ id: bomId, payload: { reason } });
                      }}
                      className="px-3 whitespace-nowrap"
                    >
                      Create revision
                    </Button>
                    <Button
                      type="button"
                      disabled={changeStatus.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Retire this BOM? It can no longer be used for new production orders."
                          )
                        ) {
                          changeStatus.mutate({
                            id: bomId,
                            status: "OBSOLETE",
                          });
                        }
                      }}
                      variant="outline"
                      className="px-3 whitespace-nowrap"
                    >
                      Retire
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  disabled={costRollup.isPending}
                  onClick={() => costRollup.mutate({ id: bomId })}
                  variant="outline"
                  className="px-3 whitespace-nowrap"
                >
                  {costRollup.isPending ? "Rolling up…" : "Roll up cost"}
                </Button>
              </div>
            )
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={changeStatus.error} />
        <ErrorBanner error={addComponent.error} />
        <ErrorBanner error={removeComponent.error} />
        <ErrorBanner error={updateComponent.error} />
        <ErrorBanner error={addSubstitute.error} />
        <ErrorBanner error={costRollup.error} />
        <ErrorBanner error={revise.error} />

        {revise.isSuccess && revise.data && (
          <Alert tone="success" title="Revision created">
            <Link
              href={`/bom/${(revise.data.data as { id: number }).id}`}
              className="font-medium text-primary transition-colors hover:text-info"
            >
              Open {(revise.data.data as { bomNumber: string }).bomNumber}
            </Link>{" "}
            — the original stays active until you activate the new version.
          </Alert>
        )}

        <div className="grid-auto-fit gap-3">
          <StatCard label="Components" value={components.length} />
          <StatCard
            label="Material cost (this level)"
            value={formatMoney(componentCost)}
            hint="At component standard costs"
          />
          <StatCard
            label="Rolled-up unit cost"
            value={
              bom?.rolledUpCost ? formatMoney(bom.rolledUpCost) : "Not costed"
            }
            hint={
              bom?.costedAt
                ? `Computed ${formatDateTime(bom.costedAt)}`
                : "Run a cost roll-up"
            }
            tone={bom?.rolledUpCost ? "positive" : "neutral"}
          />
          <StatCard
            label="Labour + overhead"
            value={formatMoney(
              Number(bom?.laborCost ?? 0) + Number(bom?.overheadCost ?? 0)
            )}
            hint="Per unit produced"
          />
        </div>

        {costRollup.isSuccess && costRollup.data && (
          <Panel title="Cost roll-up result">
            {costRollup.data.data.missingCosts.length > 0 && (
              <Alert tone="warning" className="mb-4">
                <p className="font-medium">
                  {costRollup.data.data.missingCosts.length} component(s) have
                  no standard cost on record and were counted as zero:
                </p>
                <p className="mt-1 text-xs">
                  {costRollup.data.data.missingCosts
                    .map(item => item.productCode)
                    .join(", ")}
                </p>
                <p className="mt-1 text-xs">
                  Set their standard cost for the roll-up to be complete.
                </p>
              </Alert>
            )}
            <SimpleTable
              rows={costRollup.data.data.lines}
              keyOf={row => row.productId}
              columns={[
                {
                  header: "Component",
                  cell: row => `${row.productCode} — ${row.productName}`,
                },
                {
                  header: "Qty per unit",
                  align: "right",
                  cell: row => formatQuantity(row.quantityPerUnit),
                },
                {
                  header: "Unit cost",
                  align: "right",
                  cell: row => formatMoney(row.unitCost),
                },
                {
                  header: "Extended",
                  align: "right",
                  cell: row => formatMoney(row.extendedCost),
                },
                {
                  header: "Source",
                  cell: row =>
                    row.source === "ROLLED_UP" ? (
                      <span className="text-xs text-success-foreground">
                        rolled up from its own BOM
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        standard cost
                      </span>
                    ),
                },
              ]}
            />
            <div className="mt-3 flex flex-wrap gap-4 border-t pt-3 text-sm">
              <span>
                Material:{" "}
                <strong>
                  {formatMoney(costRollup.data.data.materialCost)}
                </strong>
              </span>
              <span>
                Labour:{" "}
                <strong>{formatMoney(costRollup.data.data.laborCost)}</strong>
              </span>
              <span>
                Overhead:{" "}
                <strong>
                  {formatMoney(costRollup.data.data.overheadCost)}
                </strong>
              </span>
              <span>
                Total per unit:{" "}
                <strong>
                  {formatMoney(costRollup.data.data.totalUnitCost)}
                </strong>
              </span>
            </div>
          </Panel>
        )}

        <TabBar
          label="Bill of materials sections"
          value={tab}
          onChange={setTab}
          items={[
            ["structure", `Structure (${components.length})`],
            ["explosion", "Multi-level explosion"],
            ["costing", "Header & costing"],
            ["history", "Change history"],
          ]}
        />

        {tab === "structure" && (
          <>
            {isEditable && (
              <Panel
                title="Add a component"
                description="A component that would create a circular reference is rejected before it is saved."
              >
                <form
                  className="grid gap-4 md:grid-cols-5"
                  onSubmit={event => {
                    event.preventDefault();
                    if (!newComponent.product || !newComponent.quantity) return;
                    addComponent.mutate(
                      {
                        bomId,
                        payload: {
                          componentProductId: newComponent.product.id,
                          quantity: newComponent.quantity,
                          scrapPercent: newComponent.scrapPercent,
                          isPhantom: newComponent.isPhantom,
                          isOptional: newComponent.isOptional,
                        },
                      },
                      {
                        onSuccess: () =>
                          setNewComponent({
                            product: null,
                            quantity: "",
                            scrapPercent: "0",
                            isPhantom: false,
                            isOptional: false,
                          }),
                      }
                    );
                  }}
                >
                  <Field label="Component" className="md:col-span-2" composite>
                    <ProductPicker
                      value={newComponent.product}
                      onChange={product =>
                        setNewComponent({ ...newComponent, product })
                      }
                    />
                  </Field>
                  <Field label="Quantity per run">
                    <Input
                      required
                      inputMode="decimal"
                      value={newComponent.quantity}
                      onChange={event =>
                        setNewComponent({
                          ...newComponent,
                          quantity: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Scrap %" hint="Expected process loss">
                    <Input
                      inputMode="decimal"
                      value={newComponent.scrapPercent}
                      onChange={event =>
                        setNewComponent({
                          ...newComponent,
                          scrapPercent: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <div className="flex items-end">
                    <Button
                      type="submit"
                      disabled={
                        !newComponent.product ||
                        !newComponent.quantity ||
                        addComponent.isPending
                      }
                      className="w-full"
                    >
                      Add
                    </Button>
                  </div>
                  <div className="flex gap-4 md:col-span-5">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={newComponent.isPhantom}
                        onCheckedChange={checked =>
                          setNewComponent({
                            ...newComponent,
                            isPhantom: checked,
                          })
                        }
                      />
                      Phantom assembly — exploded through, never stocked
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={newComponent.isOptional}
                        onCheckedChange={checked =>
                          setNewComponent({
                            ...newComponent,
                            isOptional: checked,
                          })
                        }
                      />
                      Optional
                    </label>
                  </div>
                </form>
              </Panel>
            )}

            <Panel
              title="Components"
              description={
                isEditable
                  ? "This BOM is a draft, so its structure can be edited."
                  : "This BOM is frozen. Create a revision to change its structure — existing production orders must stay reproducible."
              }
            >
              <SimpleTable
                isLoading={isLoading}
                rows={components}
                keyOf={row => row.id}
                empty="No components yet. A BOM with no components cannot be activated."
                columns={[
                  {
                    header: "Line",
                    align: "right",
                    cell: row => row.lineNumber,
                  },
                  {
                    header: "Component",
                    cell: row => (
                      <div>
                        <Link
                          href={`/inventory/stock/${row.componentProduct.id}`}
                          className="font-mono text-xs text-primary hover:text-info"
                        >
                          {row.componentProduct.code}
                        </Link>
                        <p className="text-sm">{row.componentProduct.name}</p>
                        <div className="mt-0.5 flex gap-1">
                          {row.isPhantom && <Tag tone="neutral">phantom</Tag>}
                          {row.isOptional && <Tag tone="neutral">optional</Tag>}
                          {row.componentProduct.isManufactured && (
                            <Tag tone="progress">sub-assembly</Tag>
                          )}
                        </div>
                      </div>
                    ),
                  },
                  {
                    header: "Type",
                    cell: row =>
                      humanizeEnum(row.componentProduct.itemType ?? ""),
                  },
                  {
                    header: "Quantity",
                    align: "right",
                    cell: row => formatQuantity(row.quantity),
                  },
                  {
                    header: "UoM",
                    cell: row =>
                      row.uom?.code ?? row.componentProduct.uom?.code ?? "—",
                  },
                  {
                    header: "Scrap %",
                    align: "right",
                    cell: row => formatQuantity(row.scrapPercent, 2),
                  },
                  {
                    header: "Effective qty",
                    align: "right",
                    cell: row =>
                      formatQuantity(
                        Number(row.quantity) *
                          (1 + Number(row.scrapPercent) / 100)
                      ),
                  },
                  {
                    header: "Unit cost",
                    align: "right",
                    cell: row =>
                      row.componentProduct.standardCost ? (
                        formatMoney(row.componentProduct.standardCost)
                      ) : (
                        <span className="text-xs text-warning-foreground">
                          not set
                        </span>
                      ),
                  },
                  {
                    header: "Substitutes",
                    cell: row => (
                      <div className="space-y-1">
                        {row.substitutes.length === 0 && (
                          <span className="text-xs text-muted-foreground">
                            none
                          </span>
                        )}
                        {row.substitutes.map(substitute => (
                          <div
                            key={substitute.id}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span className="font-mono">
                              {substitute.substituteProduct.code}
                            </span>
                            <span className="text-muted-foreground">
                              ×{formatQuantity(substitute.conversionFactor)}
                            </span>
                            {isEditable && (
                              <button
                                type="button"
                                onClick={() =>
                                  removeSubstitute.mutate(substitute.id)
                                }
                                className="text-destructive hover:text-info"
                              >
                                remove
                              </button>
                            )}
                          </div>
                        ))}
                        {isEditable && (
                          <button
                            type="button"
                            onClick={() =>
                              setSubstituteFor(
                                substituteFor === row.id ? null : row.id
                              )
                            }
                            className="text-xs text-primary hover:text-info"
                          >
                            {substituteFor === row.id
                              ? "cancel"
                              : "+ add substitute"}
                          </button>
                        )}
                      </div>
                    ),
                  },
                  {
                    header: "",
                    cell: row =>
                      isEditable ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove ${row.componentProduct.code} from this BOM?`
                              )
                            ) {
                              removeComponent.mutate(row.id);
                            }
                          }}
                          className="rounded border px-2 py-1 text-xs text-error-foreground hover:bg-error-surface whitespace-nowrap"
                        >
                          Remove
                        </button>
                      ) : null,
                  },
                ]}
              />

              {substituteFor !== null && isEditable && (
                <form
                  className="mt-4 grid gap-3 rounded-md border bg-muted/30 p-4 md:grid-cols-4"
                  onSubmit={event => {
                    event.preventDefault();
                    if (!newSubstitute.product) return;
                    addSubstitute.mutate(
                      {
                        componentId: substituteFor,
                        payload: {
                          substituteProductId: newSubstitute.product.id,
                          priority: Number(newSubstitute.priority) || 1,
                          conversionFactor: newSubstitute.conversionFactor,
                        },
                      },
                      {
                        onSuccess: () => {
                          setSubstituteFor(null);
                          setNewSubstitute({
                            product: null,
                            priority: "1",
                            conversionFactor: "1",
                          });
                        },
                      }
                    );
                  }}
                >
                  <Field
                    label="Substitute item"
                    className="md:col-span-2"
                    composite
                  >
                    <ProductPicker
                      value={newSubstitute.product}
                      onChange={product =>
                        setNewSubstitute({ ...newSubstitute, product })
                      }
                    />
                  </Field>
                  <Field label="Priority" hint="Lower is tried first">
                    <Input
                      inputMode="numeric"
                      value={newSubstitute.priority}
                      onChange={e =>
                        setNewSubstitute({
                          ...newSubstitute,
                          priority: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field
                    label="Conversion factor"
                    hint="Substitute units per original unit"
                  >
                    <Input
                      inputMode="decimal"
                      value={newSubstitute.conversionFactor}
                      onChange={e =>
                        setNewSubstitute({
                          ...newSubstitute,
                          conversionFactor: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <div className="md:col-span-4">
                    <Button
                      type="submit"
                      disabled={
                        !newSubstitute.product || addSubstitute.isPending
                      }
                    >
                      Add substitute
                    </Button>
                  </div>
                </form>
              )}
            </Panel>
          </>
        )}

        {tab === "explosion" && (
          <Panel
            title="Multi-level explosion"
            description="Sub-assemblies with their own active BOM are expanded through. Required quantity includes each level's scrap allowance, compounded."
            actions={
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">
                  Build quantity
                </label>
                <Input
                  className="w-28"
                  inputMode="decimal"
                  value={explodeQuantity}
                  onChange={event => setExplodeQuantity(event.target.value)}
                />
              </div>
            }
          >
            <SimpleTable
              isLoading={explosionLoading}
              rows={explosionData?.data.components ?? []}
              keyOf={row => `${row.level}-${row.bomComponentId}`}
              empty="Nothing to explode — this BOM has no components."
              columns={[
                { header: "Level", align: "right", cell: row => row.level },
                {
                  header: "Component",
                  cell: row => (
                    <div style={{ paddingLeft: `${(row.level - 1) * 16}px` }}>
                      <Link
                        href={`/inventory/stock/${row.productId}`}
                        className="font-mono text-xs text-primary hover:text-info"
                      >
                        {row.productCode}
                      </Link>
                      <p className="text-sm">{row.productName}</p>
                      {row.hasChildBom && (
                        <span className="text-xs text-info-foreground">
                          has its own BOM ↓
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  header: "Type",
                  cell: row => (row.itemType ? <Tag>{row.itemType}</Tag> : "—"),
                },
                {
                  header: "Qty per parent",
                  align: "right",
                  cell: row => formatQuantity(row.quantityPerParent),
                },
                {
                  header: "Required",
                  align: "right",
                  cell: row =>
                    `${formatQuantity(row.requiredQuantity)} ${row.uomCode ?? ""}`,
                },
                {
                  header: "Scrap %",
                  align: "right",
                  cell: row => formatQuantity(row.scrapPercent, 2),
                },
                {
                  header: "Unit cost",
                  align: "right",
                  cell: row => formatMoney(row.unitCost),
                },
                {
                  header: "Extended",
                  align: "right",
                  cell: row => formatMoney(row.extendedCost),
                },
                {
                  header: "Substitutes",
                  cell: row =>
                    row.substitutes.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {row.substitutes.map(s => s.productCode).join(", ")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    ),
                },
              ]}
            />
            {explosionData && (
              <p className="mt-3 border-t pt-3 text-sm">
                Total leaf material cost for {formatQuantity(explodeQuantity)}{" "}
                unit(s):{" "}
                <strong>
                  {formatMoney(explosionData.data.totalMaterialCost)}
                </strong>
              </p>
            )}
          </Panel>
        )}

        {tab === "costing" && bom && (
          <Panel title="Header and costing">
            <div className="grid-auto-fit gap-4">
              <DetailRow label="BOM number" value={bom.bomNumber} />
              <DetailRow
                label="Version"
                value={`v${bom.version}${bom.revision}`}
              />
              <DetailRow
                label="Status"
                value={<StatusBadge status={bom.status} />}
              />
              <DetailRow
                label="Default for product"
                value={bom.isDefault ? "Yes" : "No"}
              />
              <DetailRow
                label="Output quantity"
                value={`${formatQuantity(bom.outputQuantity)} ${bom.uom?.code ?? ""}`}
              />
              <DetailRow
                label="Labour cost / unit"
                value={formatMoney(bom.laborCost)}
              />
              <DetailRow
                label="Overhead / unit"
                value={formatMoney(bom.overheadCost)}
              />
              <DetailRow
                label="Rolled-up unit cost"
                value={
                  bom.rolledUpCost
                    ? formatMoney(bom.rolledUpCost)
                    : "Not yet computed"
                }
              />
              <DetailRow
                label="Effective from"
                value={formatDate(bom.effectiveFrom)}
              />
              <DetailRow
                label="Effective to"
                value={formatDate(bom.effectiveTo)}
              />
              <DetailRow
                label="Created by"
                value={
                  `${bom.createdBy.firstName ?? ""} ${bom.createdBy.lastName ?? ""}`.trim() ||
                  "—"
                }
              />
              <DetailRow
                label="Approved by"
                value={
                  bom.approvedBy
                    ? `${bom.approvedBy.firstName ?? ""} ${bom.approvedBy.lastName ?? ""}`.trim()
                    : "—"
                }
              />
              <DetailRow
                label="Supersedes"
                value={
                  bom.previousVersion ? (
                    <Link
                      href={`/bom/${bom.previousVersion.id}`}
                      className="text-primary hover:text-info"
                    >
                      {bom.previousVersion.bomNumber} (v
                      {bom.previousVersion.version}
                      {bom.previousVersion.revision})
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow
                label="Superseded by"
                value={
                  bom.nextVersion ? (
                    <Link
                      href={`/bom/${bom.nextVersion.id}`}
                      className="text-primary hover:text-info"
                    >
                      {bom.nextVersion.bomNumber} (v{bom.nextVersion.version}
                      {bom.nextVersion.revision})
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              {bom.notes && <DetailRow label="Notes" value={bom.notes} />}
            </div>
          </Panel>
        )}

        {tab === "history" && (
          <Panel
            title="Change history"
            description="Every structural and status change, with who made it and why"
          >
            <SimpleTable
              isLoading={historyLoading}
              rows={historyEntries}
              keyOf={row => row.id}
              empty="No changes recorded yet."
              columns={[
                { header: "When", cell: row => formatDateTime(row.createdAt) },
                {
                  header: "Change",
                  cell: row =>
                    row.changeType ? <Tag>{row.changeType}</Tag> : "—",
                },
                { header: "Description", cell: row => row.description },
                { header: "From", cell: row => row.oldValue ?? "—" },
                { header: "To", cell: row => row.newValue ?? "—" },
                { header: "Reason", cell: row => row.reason ?? "—" },
                {
                  header: "By",
                  cell: row =>
                    `${row.changedBy.firstName ?? ""} ${row.changedBy.lastName ?? ""}`.trim() ||
                    "—",
                },
              ]}
            />
          </Panel>
        )}
      </PageShell>
    </ProtectedRoute>
  );
}
