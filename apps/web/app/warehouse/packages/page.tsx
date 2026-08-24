"use client";

import { useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  ErrorBanner,
  PageHeader,
  Pager,
  Panel,
  SelectField,
  SimpleTable,
  StatusBadge,
  DEFAULT_PAGE_SIZE,
} from "@/components/supply-chain/shared";
import { usePackages } from "@/hooks/useSupplyChain";
import {
  formatDateTime,
  formatQuantity,
  humanizeEnum,
} from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { DashboardToolbar } from "@repo/ui/components/ui/dashboard-toolbar";

export default function PackagesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("PACKED");

  const { packages, pagination, isLoading, error } = usePackages({
    page,
    limit: DEFAULT_PAGE_SIZE,
    status: status || undefined,
  });

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Packages"
          subtitle="Parcels that are packed and waiting to be sent out."
        />

        <ErrorBanner error={error} />

        <Panel
          flush
          actions={
            <DashboardToolbar
              actions={
                <SelectField
                  aria-label="Filter by status"
                  className="w-full sm:w-48"
                  value={status}
                  onChange={event => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="OPEN">Open</option>
                  <option value="PACKED">Packed — awaiting dispatch</option>
                  <option value="SHIPPED">Shipped</option>
                  <option value="CANCELLED">Cancelled</option>
                </SelectField>
              }
            />
          }
        >
          <SimpleTable
            isLoading={isLoading}
            rows={packages}
            keyOf={row => row.id}
            empty="No packages match. Pack a pick list to create one."
            columns={[
              {
                header: "Package",
                cell: row => (
                  <span className="font-mono text-xs text-primary">
                    {row.packageNumber}
                  </span>
                ),
              },
              {
                header: "Pick list",
                cell: row =>
                  row.pickList ? (
                    <Link
                      href={`/warehouse/pick-lists/${row.pickList.id}`}
                      className="text-primary hover:text-info"
                    >
                      {row.pickList.pickListNumber}
                    </Link>
                  ) : (
                    "—"
                  ),
              },
              {
                header: "For",
                cell: row =>
                  row.pickList?.referenceNumber ??
                  humanizeEnum(row.pickList?.referenceType ?? ""),
              },
              {
                header: "Lines",
                align: "right",
                cell: row => row._count?.lines ?? row.lines?.length ?? 0,
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
              {
                header: "Status",
                cell: row => <StatusBadge status={row.status} />,
              },
              { header: "Packed", cell: row => formatDateTime(row.packedAt) },
              { header: "Shipped", cell: row => formatDateTime(row.shippedAt) },
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
