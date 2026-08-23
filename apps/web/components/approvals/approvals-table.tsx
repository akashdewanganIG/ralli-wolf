"use client";

import * as React from "react";
import { DataTable, type TableColumn } from "@/components/data-table";
import type { Approval } from "./approval-types";
import { Tag } from "@repo/ui/components/ui/tag";
import { statusTone } from "@repo/ui/components/ui/status-badge";

type ApprovalsTableProps = {
  approvals: Approval[];
  title: string;
  onQuoteNoClick?: (approval: Approval) => void;
  columnPreferenceKey?: string;
  /** Rendered to the left of the Columns button */
  headerLeadingContent?: React.ReactNode;
  count: number;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
};

function formatDate(iso: string) {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ApprovalsTable({
  approvals,
  title,
  onQuoteNoClick,
  columnPreferenceKey = "approvals-table",
  headerLeadingContent,
  count,
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}: ApprovalsTableProps) {
  const columns = React.useMemo<TableColumn<Approval>[]>(
    () => [
      {
        key: "quoteNo",
        label: "Quote No",
        render: (value, item) =>
          onQuoteNoClick ? (
            <button
              type="button"
              className="text-info-foreground hover:text-info"
              onClick={e => {
                e.stopPropagation();
                onQuoteNoClick(item);
              }}
            >
              {String(value)}
            </button>
          ) : (
            String(value)
          ),
      },
      { key: "targetObjectId", label: "Target Object Id" },
      {
        key: "status",
        label: "Status",
        render: v => <Tag tone={statusTone(String(v))}>{String(v)}</Tag>,
      },
      { key: "createdBy", label: "Created By" },
      {
        key: "createdDate",
        label: "Created Date",
        render: v => formatDate(String(v)),
      },
    ],
    [onQuoteNoClick]
  );

  return (
    <DataTable<Approval>
      data={approvals}
      columns={columns}
      title={title}
      count={count}
      currentPage={currentPage}
      totalPages={totalPages}
      itemsPerPage={itemsPerPage}
      onPageChange={onPageChange}
      onItemsPerPageChange={onItemsPerPageChange}
      onRowClick={onQuoteNoClick}
      columnPreferenceKey={columnPreferenceKey}
      headerLeadingContent={headerLeadingContent}
    />
  );
}
