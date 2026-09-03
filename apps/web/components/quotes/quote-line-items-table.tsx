"use client";

import * as React from "react";
import { DataTable, type TableColumn } from "@/components/data-table";
import { formatMoney } from "@/lib/utils/decimal";

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
  count: number;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
};

export function QuoteLineItemsTable({
  items,
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
          <span className="text-muted-foreground">{formatMoney(v)}</span>
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
          <span className="text-muted-foreground">{formatMoney(v)}</span>
        ),
      },
      {
        key: "totalPrice",
        label: "Total Price",
        render: v => (
          <span className="text-muted-foreground">{formatMoney(v)}</span>
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
      />
    </div>
  );
}
