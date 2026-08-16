"use client";

import * as React from "react";
import { DataTable, type TableColumn } from "@/components/data-table";

export type QuoteLineItemRow = {
  id: string;
  productName: string;
  productCode: string;
  quantity: number;
  listPrice: number;
  discount: number;
  unitPrice: number;
  totalPrice: number;
};

type QuoteLineItemsTableProps = {
  items: QuoteLineItemRow[];
  onRowClick?: (item: QuoteLineItemRow) => void;
  count: number;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
};

export function QuoteLineItemsTable({
  items,
  onRowClick,
  count,
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}: QuoteLineItemsTableProps) {
  const columns = React.useMemo<TableColumn<QuoteLineItemRow>[]>(
    () => [
      {
        key: "productName",
        label: "Product Name",
        render: value => (
          <span className="text-muted-foreground">{value ?? "—"}</span>
        ),
      },
      {
        key: "productCode",
        label: "Product Code",
        render: value => (
          <span className="text-muted-foreground">{value ?? "—"}</span>
        ),
      },
      {
        key: "quantity",
        label: "Quantity",
        render: value => (
          <span className="text-muted-foreground">{value ?? "—"}</span>
        ),
      },
      {
        key: "listPrice",
        label: "List Price",
        render: v => (
          <span className="text-muted-foreground">
            {v != null ? `₹${Number(v).toLocaleString()}` : "—"}
          </span>
        ),
      },
      {
        key: "discount",
        label: "Discount (%)",
        render: v => (
          <span className="text-muted-foreground">
            {v != null ? `${Number(v).toFixed(2)}%` : "—"}
          </span>
        ),
      },
      {
        key: "unitPrice",
        label: "Unit Price",
        render: v => (
          <span className="text-muted-foreground">
            {v != null ? `₹${Number(v).toLocaleString()}` : "—"}
          </span>
        ),
      },
      {
        key: "totalPrice",
        label: "Total Price",
        render: v => (
          <span className="text-muted-foreground">
            {v != null ? `₹${Number(v).toLocaleString()}` : "—"}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-3">
      <DataTable<QuoteLineItemRow>
        data={items}
        columns={columns}
        title="Quote Line Items"
        count={count}
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        onPageChange={onPageChange}
        onItemsPerPageChange={onItemsPerPageChange}
        onRowClick={onRowClick}
      />
    </div>
  );
}
