"use client";

import { useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  ErrorBanner,
  FilterBar,
  PageHeader,
  Pager,
  Panel,
  SelectField,
  SimpleTable,
  StatCard,
  StatusBadge,
  DEFAULT_PAGE_SIZE,
} from "@/components/supply-chain/shared";
import { useQualityChecks, useSuppliers } from "@/hooks/useSupplyChain";
import { formatDateTime, formatQuantity } from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";

export default function QualityChecksPage() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState("");
  const [supplierId, setSupplierId] = useState("");

  const { checks, pagination, isLoading, error } = useQualityChecks({
    page,
    limit: DEFAULT_PAGE_SIZE,
    result: result || undefined,
    supplierId: supplierId ? Number(supplierId) : undefined,
  });
  const { suppliers } = useSuppliers({ limit: 200 });

  const failed = checks.filter(check => check.result === "FAIL").length;
  const conditional = checks.filter(
    check => check.result === "CONDITIONAL_PASS"
  ).length;
  const totalRejected = checks.reduce(
    (acc, check) => acc + Number(check.rejectedQuantity),
    0
  );

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Quality checks"
          subtitle="Review receipt inspections and supplier quality results."
        />

        <ErrorBanner error={error} />

        <div className="grid-auto-fit gap-3">
          <StatCard label="Inspections shown" value={checks.length} />
          <StatCard
            label="Failed"
            value={failed}
            tone={failed ? "critical" : "positive"}
          />
          <StatCard
            label="Passed with conditions"
            value={conditional}
            tone={conditional ? "warning" : "neutral"}
          />
          <StatCard
            label="Quantity rejected"
            value={formatQuantity(totalRejected)}
            tone={totalRejected > 0 ? "critical" : "positive"}
          />
        </div>

        <Panel
          actions={
            <FilterBar>
              <SelectField
                className="w-full sm:w-48"
                value={result}
                onChange={event => {
                  setResult(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All results</option>
                <option value="PENDING">Pending</option>
                <option value="PASS">Pass</option>
                <option value="CONDITIONAL_PASS">Conditional pass</option>
                <option value="FAIL">Fail</option>
              </SelectField>
              <SelectField
                className="w-full sm:w-52"
                value={supplierId}
                onChange={event => {
                  setSupplierId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All suppliers</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </SelectField>
            </FilterBar>
          }
        >
          <SimpleTable
            isLoading={isLoading}
            rows={checks}
            keyOf={row => row.id}
            rowClassName={row =>
              row.result === "FAIL"
                ? "bg-error-surface/40"
                : row.result === "CONDITIONAL_PASS"
                  ? "bg-warning-surface/30"
                  : ""
            }
            empty="No inspections recorded yet. Mark a goods receipt as requiring QC to route it through inspection."
            columns={[
              {
                header: "QC",
                cell: row => (
                  <span className="font-mono text-xs text-primary">
                    {row.qcNumber}
                  </span>
                ),
              },
              {
                header: "GRN",
                cell: row =>
                  row.grn ? (
                    <Link
                      href={`/purchasing/goods-receipts/${row.grn.id}`}
                      className="font-mono text-xs text-primary hover:text-info"
                    >
                      {row.grn.grnNumber}
                    </Link>
                  ) : (
                    "—"
                  ),
              },
              {
                header: "Supplier",
                cell: row => row.grn?.supplier.name ?? "—",
              },
              {
                header: "Item",
                cell: row =>
                  row.grnLine ? (
                    <Link
                      href={`/inventory/stock/${row.grnLine.product.id}`}
                      className="text-primary hover:text-info"
                    >
                      <span className="font-mono text-xs">
                        {row.grnLine.product.code}
                      </span>
                      <span className="ml-2 text-sm">
                        {row.grnLine.product.name}
                      </span>
                    </Link>
                  ) : (
                    "—"
                  ),
              },
              {
                header: "Inspected",
                align: "right",
                cell: row => formatQuantity(row.inspectedQuantity),
              },
              {
                header: "Accepted",
                align: "right",
                cell: row => formatQuantity(row.acceptedQuantity),
              },
              {
                header: "Rejected",
                align: "right",
                cell: row =>
                  Number(row.rejectedQuantity) > 0 ? (
                    <span className="font-semibold text-error-foreground">
                      {formatQuantity(row.rejectedQuantity)}
                    </span>
                  ) : (
                    "—"
                  ),
              },
              {
                header: "Result",
                cell: row => <StatusBadge status={row.result} />,
              },
              { header: "Defect", cell: row => row.defectType ?? "—" },
              {
                header: "Parameters",
                cell: row =>
                  row.parameters.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <span className="text-xs">
                      {
                        row.parameters.filter(parameter => parameter.isPassed)
                          .length
                      }
                      /{row.parameters.length} within spec
                    </span>
                  ),
              },
              {
                header: "Inspector",
                cell: row =>
                  `${row.inspectedBy.firstName ?? ""} ${row.inspectedBy.lastName ?? ""}`.trim() ||
                  "—",
              },
              { header: "When", cell: row => formatDateTime(row.inspectedAt) },
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
