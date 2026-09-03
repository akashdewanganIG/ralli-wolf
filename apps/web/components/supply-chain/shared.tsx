"use client";

import React from "react";
import Link from "next/link";
import { humanizeEnum } from "@/lib/utils/decimal";
import { Alert } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { PageHeader as SharedPageHeader } from "@repo/ui/components/ui/page-header";
import { InfoHint } from "@repo/ui/components/ui/info-hint";
import { CardActionButton } from "@repo/ui/components/ui/card-action-button";
import { Skeleton, SkeletonRegion } from "@repo/ui/components/ui/skeleton";
import {
  MetricCard,
  type MetricTone,
} from "@repo/ui/components/ui/metric-card";
export { SelectField } from "@repo/ui/components/ui/select-field";

export { DEFAULT_PAGE_SIZE } from "../data-table";

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: Array<{ label: string; href?: string }>;
}) {
  return (
    <SharedPageHeader
      title={title}
      description={subtitle}
      actions={actions}
      breadcrumb={breadcrumb}
    />
  );
}

export function FilterBar({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid w-full min-w-0 grid-cols-1 items-center gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-1 lg:flex-wrap lg:justify-end [&>*]:min-w-0 ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  description,
  tone = "neutral",
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  description?: React.ReactNode;
  tone?: MetricTone;
  href?: string;
}) {
  return (
    <MetricCard
      label={label}
      value={value}
      hint={hint}
      description={description}
      tone={tone}
      href={href}
    />
  );
}

export {
  StatusBadge,
  SeverityBadge,
  statusTone,
  type SemanticTone,
} from "@repo/ui/components/ui/status-badge";

export function Panel({
  title,
  description,
  actions,
  footerAction,
  flush = false,
  children,
  className = "",
}: {
  title?: string;

  description?: React.ReactNode;

  actions?: React.ReactNode;

  footerAction?: React.ReactNode;

  flush?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const hasHeader = Boolean(title || actions);

  return (
    <section
      className={`flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm shadow-foreground/[0.02] ${className}`}
    >
      {hasHeader && (
        <header className="flex flex-col gap-2 border-b border-border p-3 lg:flex-row lg:items-center lg:gap-3">
          {title && (
            <div className="flex min-w-0 shrink-0 items-center gap-1.5">
              <h2 className="min-w-0 truncate text-sm font-semibold leading-5 text-foreground">
                {title}
              </h2>
              <InfoHint label={description} />
            </div>
          )}
          {actions && (
            <div className="flex w-full min-w-0 flex-1 flex-wrap items-center gap-2 lg:justify-end">
              {actions}
            </div>
          )}
        </header>
      )}

      <div className={`min-w-0 flex-1 ${flush ? "" : "p-3"}`}>{children}</div>
      {footerAction && (
        <div className="flex flex-col border-t border-border p-3 pt-2.5">
          {footerAction}
        </div>
      )}
    </section>
  );
}

export function PanelInset({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`px-3 pt-3 ${className}`}>{children}</div>;
}

export function SimpleTable<T>({
  columns,
  rows,
  keyOf,
  empty = "Nothing to show",
  isLoading = false,
  onRowClick,
  rowClassName,
}: {
  columns: Array<{
    header: string;
    cell: (row: T) => React.ReactNode;
    align?: "left" | "right" | "center";
    width?: string;
  }>;
  rows: T[];
  keyOf: (row: T) => string | number;
  empty?: React.ReactNode;
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
}) {
  if (isLoading) {
    return (
      <SkeletonRegion
        label="Loading table data"
        className="max-w-full overflow-x-auto overscroll-x-contain"
      >
        <table className="w-full min-w-[45rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle">
              {columns.map(column => (
                <th
                  key={column.header}
                  style={column.width ? { width: column.width } : undefined}
                  className={`sticky top-0 z-10 h-10 whitespace-nowrap bg-surface-subtle px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${
                    column.align === "right"
                      ? "text-right"
                      : column.align === "center"
                        ? "text-center"
                        : "text-left"
                  }`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-border/80 last:border-0"
              >
                {columns.map((column, colIndex) => (
                  <td key={column.header} className="px-4 py-3 align-middle">
                    <Skeleton
                      className={`h-3.5 ${
                        column.align === "right" ? "ml-auto " : ""
                      }${
                        colIndex === 0
                          ? "w-3/4"
                          : colIndex % 3 === 0
                            ? "w-1/2"
                            : "w-2/3"
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </SkeletonRegion>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }

  return (
    <div className="max-w-full overscroll-x-contain overflow-x-auto">
      <table className="w-full min-w-[45rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-subtle">
            {columns.map(column => (
              <th
                key={column.header}
                style={column.width ? { width: column.width } : undefined}
                className={`sticky top-0 z-10 h-10 whitespace-nowrap bg-surface-subtle px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${
                  column.align === "right"
                    ? "text-right"
                    : column.align === "center"
                      ? "text-center"
                      : "text-left"
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={keyOf(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? event => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              className={`border-b border-border/80 transition-colors last:border-0 hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 ${onRowClick ? "cursor-pointer" : ""} ${
                rowClassName ? rowClassName(row) : ""
              }`}
            >
              {columns.map(column => (
                <td
                  key={column.header}
                  className={`px-4 py-3 align-middle ${
                    column.align === "right"
                      ? "text-right tabular-nums"
                      : column.align === "center"
                        ? "text-center"
                        : "text-left"
                  }`}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number | undefined;
  onChange: (page: number) => void;
}) {
  const pages = totalPages ?? 1;
  if (pages <= 1) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-border p-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange(Math.min(pages, page + 1))}
          disabled={page >= pages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  className = "",
  composite = false,
}: {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  composite?: boolean;
}) {
  const content = (
    <>
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      )}
    </>
  );

  return composite ? (
    <div className={`block ${className}`} role="group" aria-label={label}>
      {content}
    </div>
  ) : (
    <label className={`block ${className}`}>{content}</label>
  );
}

export function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="break-words text-sm font-medium text-foreground">
        {value ?? "—"}
      </span>
    </div>
  );
}

export function ErrorBanner({
  error,
  className = "",
}: {
  error: unknown;
  className?: string;
}) {
  if (!error) return null;
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "Something went wrong";
  const details =
    typeof error === "object" &&
    error !== null &&
    "details" in error &&
    error.details
      ? JSON.stringify((error as { details: unknown }).details)
      : null;

  return (
    <Alert tone="error" title={message} className={className}>
      {details && (
        <p className="mt-1 break-all text-xs opacity-80">{details}</p>
      )}
    </Alert>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-subtle/60 px-4 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
