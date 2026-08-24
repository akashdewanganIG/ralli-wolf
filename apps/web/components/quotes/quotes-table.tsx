"use client";

import * as React from "react";
import { Checkbox, Button } from "@repo/ui";
import { DataTable, type TableColumn } from "@/components/data-table";
import type { Quote } from "./quote-types";
import { formatMoney } from "@/lib/utils/decimal";

type QuotesTableProps = {
  quotes: Quote[];
  title?: string;
  showCreateButton?: boolean;
  onCreateClick?: () => void;
  onQuoteClick?: (quote: Quote) => void;
};

export function QuotesTable({
  quotes,
  title = "Quotes",
  showCreateButton = false,
  onCreateClick,
  onQuoteClick,
}: QuotesTableProps) {
  const columns = React.useMemo<TableColumn<Quote>[]>(
    () => [
      {
        key: "quoteNumber",
        label: "Quote Number",
        render: (value, item) => (
          <button
            type="button"
            className="text-muted-foreground hover:text-info"
            onClick={e => {
              e.stopPropagation();
              onQuoteClick?.(item);
            }}
          >
            {String(value)}
          </button>
        ),
      },
      {
        key: "isPrimary",
        label: "Primary",
        render: value => (
          <Checkbox
            checked={Boolean(value)}
            disabled
            aria-label="primary quote"
          />
        ),
      },
      {
        key: "netAmount",
        label: "Net Amount",
        render: value => (
          <span className="text-muted-foreground">
            {formatMoney(value ?? 0)}
          </span>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: value => (
          <span className="text-muted-foreground">{value || "-"}</span>
        ),
      },
      {
        key: "createdBy",
        label: "Created By",
        render: value => (
          <span className="text-muted-foreground">{value || "-"}</span>
        ),
      },
      {
        key: "startDate",
        label: "Start Date",
        render: value => (
          <span className="text-muted-foreground">{value || "-"}</span>
        ),
      },
      {
        key: "endDate",
        label: "End Date",
        render: value => (
          <span className="text-muted-foreground">{value || "-"}</span>
        ),
      },
    ],
    [onQuoteClick]
  );

  return (
    <div className="space-y-3">
      <DataTable<Quote>
        data={quotes}
        columns={columns}
        title={title}
        count={quotes.length}
        onRowClick={onQuoteClick}
        headerTrailingContent={
          showCreateButton ? (
            <Button onClick={onCreateClick}>Create Quote</Button>
          ) : undefined
        }
      />
    </div>
  );
}
