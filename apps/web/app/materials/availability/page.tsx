"use client";

import { useState } from "react";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  EmptyState,
  ErrorBanner,
  Field,
  PageHeader,
  Panel,
  SimpleTable,
  StatCard,
} from "@/components/supply-chain/shared";
import { WarehouseFilter } from "@/components/supply-chain/WarehouseFilter";
import {
  ProductPicker,
  type PickedProduct,
} from "@/components/supply-chain/ProductPicker";
import { useMaterialMutations } from "@/hooks/useSupplyChain";
import {
  formatMoney,
  formatPercent,
  formatQuantity,
  humanizeEnum,
} from "@/lib/utils/decimal";
import type { AvailabilityLine } from "@/lib/api/types/supplyChain";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { Tag } from "@repo/ui/components/ui/tag";

export default function MaterialAvailabilityPage() {
  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [includeSubstitutes, setIncludeSubstitutes] = useState(true);
  const [expandedLine, setExpandedLine] = useState<number | null>(null);

  const { checkAvailability } = useMaterialMutations();
  const result = checkAvailability.data?.data;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!product) return;
    checkAvailability.mutate({
      productId: product.id,
      quantity,
      warehouseId,
      includeSubstitutes,
    });
  };

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Material availability"
          subtitle="Check component availability for a planned build."
        />

        <Panel title="What do you want to build?">
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
            <Field label="Product to build" className="md:col-span-2" composite>
              <ProductPicker
                value={product}
                onChange={setProduct}
                placeholder="Search the tool or assembly to build…"
                autoFocus
              />
            </Field>
            <Field label="Build quantity">
              <Input
                value={quantity}
                onChange={event => setQuantity(event.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field
              label="Warehouse"
              hint="Leave blank to check across every location"
              composite
            >
              <WarehouseFilter value={warehouseId} onChange={setWarehouseId} />
            </Field>
            <label className="flex items-center gap-2 text-sm md:col-span-4">
              <Checkbox
                checked={includeSubstitutes}
                onCheckedChange={setIncludeSubstitutes}
              />
              Include approved substitutes for any short component
            </label>
            <div className="md:col-span-4">
              <Button
                type="submit"
                disabled={!product || checkAvailability.isPending}
              >
                {checkAvailability.isPending
                  ? "Checking…"
                  : "Check availability"}
              </Button>
            </div>
          </form>
        </Panel>

        <ErrorBanner error={checkAvailability.error} />

        {!result &&
          !checkAvailability.isPending &&
          !checkAvailability.error && (
            <EmptyState
              title="Nothing checked yet"
              description="Pick a product with an active bill of materials and a build quantity. Every component is compared against stock that is genuinely free — reserved units are excluded."
            />
          )}

        {result && (
          <>
            <div className="grid-auto-fit gap-3">
              <StatCard
                label="Can this build run?"
                value={result.canBuild ? "Yes" : "No"}
                tone={result.canBuild ? "positive" : "critical"}
                hint={
                  result.canBuild
                    ? "Every component is covered"
                    : `${result.lines.filter(line => line.isShort).length} component(s) short`
                }
              />
              <StatCard
                label="Buildable from stock"
                value={formatQuantity(result.buildableQuantity)}
                hint={`of ${formatQuantity(result.requestedQuantity)} requested`}
                tone={
                  Number(result.buildableQuantity) >=
                  Number(result.requestedQuantity)
                    ? "positive"
                    : "warning"
                }
              />
              <StatCard
                label="Material cost"
                value={formatMoney(result.totalMaterialCost)}
                hint="At current standard costs"
              />
              <StatCard
                label="Bill of materials"
                value={result.bomNumber}
                hint="Active revision in effect today"
                href={`/bom/${result.bomId}`}
              />
            </div>

            <Panel
              title="Component requirements"
              description="Required quantity includes each level's scrap allowance, compounded down the tree."
            >
              <SimpleTable<AvailabilityLine>
                rows={result.lines}
                keyOf={row => row.productId}
                rowClassName={row => (row.isShort ? "bg-error-surface/40" : "")}
                empty="This bill of materials has no leaf components."
                columns={[
                  {
                    header: "Component",
                    cell: row => (
                      <Link
                        href={`/inventory/stock/${row.productId}`}
                        className="text-primary hover:text-info"
                      >
                        <span className="font-mono text-xs">
                          {row.productCode}
                        </span>
                        <span className="ml-2 text-sm">{row.productName}</span>
                      </Link>
                    ),
                  },
                  {
                    header: "Type",
                    cell: row =>
                      row.itemType ? <Tag>{row.itemType}</Tag> : "—",
                  },
                  {
                    header: "Required",
                    align: "right",
                    cell: row =>
                      `${formatQuantity(row.requiredQuantity)} ${row.uomCode ?? ""}`,
                  },
                  {
                    header: "Available",
                    align: "right",
                    cell: row => formatQuantity(row.availableQuantity),
                  },
                  {
                    header: "On order",
                    align: "right",
                    cell: row => formatQuantity(row.incomingQuantity),
                  },
                  {
                    header: "Short by",
                    align: "right",
                    cell: row =>
                      Number(row.shortfallQuantity) > 0 ? (
                        <span className="font-semibold text-error-foreground">
                          {formatQuantity(row.shortfallQuantity)}
                        </span>
                      ) : (
                        <span className="text-success-foreground">covered</span>
                      ),
                  },
                  {
                    header: "Short after incoming",
                    align: "right",
                    cell: row =>
                      Number(row.netShortfallQuantity) > 0 ? (
                        <span className="font-semibold text-error-foreground">
                          {formatQuantity(row.netShortfallQuantity)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      ),
                  },
                  {
                    header: "Coverage",
                    align: "right",
                    cell: row => formatPercent(row.coveragePercent),
                  },
                  {
                    header: "Substitutes",
                    cell: row =>
                      row.substitutes.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          none
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedLine(
                              expandedLine === row.productId
                                ? null
                                : row.productId
                            )
                          }
                          className="text-xs text-primary hover:text-info"
                        >
                          {row.substitutes.length} option(s)
                        </button>
                      ),
                  },
                ]}
              />

              {expandedLine !== null &&
                (() => {
                  const line = result.lines.find(
                    entry => entry.productId === expandedLine
                  );
                  if (!line || line.substitutes.length === 0) return null;
                  return (
                    <div className="mt-4 rounded-md border bg-muted/30 p-4">
                      <p className="mb-2 text-sm font-medium">
                        Approved substitutes for {line.productCode}
                      </p>
                      <SimpleTable
                        rows={line.substitutes}
                        keyOf={row => row.productId}
                        columns={[
                          {
                            header: "Priority",
                            align: "right",
                            cell: row => row.priority,
                          },
                          {
                            header: "Substitute",
                            cell: row => (
                              <Link
                                href={`/inventory/stock/${row.productId}`}
                                className="text-primary hover:text-info"
                              >
                                <span className="font-mono text-xs">
                                  {row.productCode}
                                </span>
                                <span className="ml-2 text-sm">
                                  {row.productName}
                                </span>
                              </Link>
                            ),
                          },
                          {
                            header: "Conversion",
                            align: "right",
                            cell: row =>
                              `${formatQuantity(row.conversionFactor)} per unit`,
                          },
                          {
                            header: "Available",
                            align: "right",
                            cell: row => formatQuantity(row.availableQuantity),
                          },
                          {
                            header: "Covers",
                            align: "right",
                            cell: row =>
                              `${formatQuantity(row.coverableQuantity)} of the original`,
                          },
                        ]}
                      />
                    </div>
                  );
                })()}
            </Panel>
          </>
        )}
      </PageShell>
    </ProtectedRoute>
  );
}
