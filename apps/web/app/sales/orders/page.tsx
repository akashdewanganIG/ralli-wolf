"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useSalesOrdersWithPagination } from "@/hooks/useSalesOrders";
import { DataTable, type TableColumn } from "@/components/data-table";
import type { SalesOrderListItem } from "@/lib/api/types";
import { PageHeader } from "@repo/ui/components/ui/page-header";
import { TablePageSkeleton } from "@/components/skeletons";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { DEFAULT_PAGE_SIZE } from "@/components/data-table";

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function OrdersPage() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);

  const {
    data: orders,
    pagination,
    isLoading,
  } = useSalesOrdersWithPagination({
    page: currentPage,
    limit: itemsPerPage,
  });

  const columns: TableColumn<SalesOrderListItem>[] = [
    {
      key: "orderNumber",
      label: "Order Number",
      render: (val, item) => (
        <button
          type="button"
          onClick={() => router.push(`/sales/orders/${item.id}`)}
          className="font-mono text-sm text-info-foreground hover:text-info"
        >
          {val as string}
        </button>
      ),
    },
    {
      key: "account",
      label: "Account Name",
      render: (_, item) => item.account.name,
    },
    {
      key: "owner",
      label: "Created By",
      render: (_, item) =>
        `${item.owner.firstName ?? ""} ${item.owner.lastName ?? ""}`.trim() ||
        "—",
    },
    {
      key: "createdAt",
      label: "Created At",
      render: val => formatDate(val as string),
    },
  ];

  if (isLoading) {
    return (
      <ProtectedRoute>
        <TablePageSkeleton filters={0} />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Sales orders"
          description={`${pagination?.totalItems ?? orders.length} order${(pagination?.totalItems ?? orders.length) === 1 ? "" : "s"} created from accepted quotes.`}
        />

        <DataTable<SalesOrderListItem>
          data={orders}
          columns={columns}
          title="Sales Orders"
          count={pagination?.totalItems ?? orders.length}
          currentPage={currentPage}
          totalPages={pagination?.totalPages ?? 1}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={n => {
            setItemsPerPage(n);
            setCurrentPage(1);
          }}
        />
      </PageShell>
    </ProtectedRoute>
  );
}
