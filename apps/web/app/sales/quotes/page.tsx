"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { DataTable, type TableColumn } from "@/components/data-table";
import { useQuotesWithPagination } from "@/hooks/useQuotes";
import type { QuoteListItem } from "@/lib/api/types";
import { Alert } from "@repo/ui/components/ui/alert";
import { TablePageSkeleton } from "@/components/skeletons";
import { PageHeader } from "@repo/ui/components/ui/page-header";

export type QuoteTableRow = {
  id: string;
  quoteNumber: string;
  netAmount: number;
  status: string;
  createdBy: string;
  startDate: string;
  endDate: string;
};

function mapQuoteToTableRow(quote: QuoteListItem): QuoteTableRow {
  const grandTotal = quote.grandTotal;
  const netAmount =
    typeof grandTotal === "number" ? grandTotal : Number(grandTotal) || 0;
  const created = quote.createdAt ? new Date(quote.createdAt) : new Date();
  const validUntil = quote.validUntil ? new Date(quote.validUntil) : null;
  const preparedBy = quote.preparedBy;
  const createdBy = preparedBy
    ? [preparedBy.firstName, preparedBy.lastName].filter(Boolean).join(" ") ||
      "—"
    : "—";

  return {
    id: String(quote.id),
    quoteNumber: quote.quoteNumber,
    netAmount,
    status: quote.status ?? "—",
    createdBy,
    startDate: created.toISOString().slice(0, 10),
    endDate: validUntil
      ? validUntil.toISOString().slice(0, 10)
      : created.toISOString().slice(0, 10),
  };
}

export default function QuotesPage() {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);

  const {
    data: quotes = [],
    pagination,
    isLoading,
    isError,
    error,
  } = useQuotesWithPagination({
    page,
    limit: itemsPerPage,
  });

  const tableRows = React.useMemo(
    () => quotes.map(mapQuoteToTableRow),
    [quotes]
  );

  const columns = React.useMemo<TableColumn<QuoteTableRow>[]>(
    () => [
      {
        key: "quoteNumber",
        label: "Quote Number",
        render: value => (
          <span className="text-muted-foreground hover:underline hover:text-blue-400">
            {String(value)}
          </span>
        ),
      },
      {
        key: "netAmount",
        label: "Net Amount",
        render: value => (
          <span className="text-muted-foreground">
            ₹{Number(value ?? 0).toLocaleString()}
          </span>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: value => (
          <span className="text-muted-foreground">{value ?? "-"}</span>
        ),
      },
      {
        key: "createdBy",
        label: "Created By",
        render: value => (
          <span className="text-muted-foreground">{value ?? "-"}</span>
        ),
      },
      {
        key: "startDate",
        label: "Start Date",
        render: value => (
          <span className="text-muted-foreground">{value ?? "-"}</span>
        ),
      },
      {
        key: "endDate",
        label: "End Date",
        render: value => (
          <span className="text-muted-foreground">{value ?? "-"}</span>
        ),
      },
    ],
    []
  );

  const handlePageChange = React.useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleItemsPerPageChange = React.useCallback(
    (newItemsPerPage: number) => {
      setItemsPerPage(newItemsPerPage);
      setPage(1);
    },
    []
  );

  if (isLoading) {
    return (
      <RoleGuard allowedRoles={["ADMIN", "ADMIN", "SALES"]}>
        <TablePageSkeleton filters={0} />
      </RoleGuard>
    );
  }

  if (isError) {
    return (
      <RoleGuard allowedRoles={["ADMIN", "ADMIN", "SALES"]}>
        <div className="app-page">
          <Alert tone="error" title="Quotes could not be loaded">
            {error && typeof error === "object" && "message" in error
              ? String((error as { message: string }).message)
              : "Failed to load quotes."}
          </Alert>
        </div>
      </RoleGuard>
    );
  }

  const totalItems = pagination?.totalItems ?? tableRows.length;
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <RoleGuard allowedRoles={["ADMIN", "ADMIN", "SALES"]}>
      <div className="space-y-5 p-4">
        <PageHeader
          title="Quotes"
          description={`${totalItems} quote${totalItems === 1 ? "" : "s"} across the sales workspace.`}
        />

        <DataTable<QuoteTableRow>
          data={tableRows}
          columns={columns}
          title="Quote Table"
          count={totalItems}
          currentPage={page}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
          onRowClick={item => router.push(`/sales/quotes/${item.id}`)}
          getRowHref={item => `/sales/quotes/${item.id}`}
        />
      </div>
    </RoleGuard>
  );
}
