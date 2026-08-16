"use client";

import React from "react";
import Link from "next/link";
import { humanizeEnum } from "@/lib/utils/decimal";
import { Alert } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { PageHeader as SharedPageHeader } from "@repo/ui/components/ui/page-header";
export { SelectField } from "@repo/ui/components/ui/select-field";

/**
 * Small building blocks shared by every supply-chain screen, so the five
 * modules read as one system rather than five bolted-on apps.
 */

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

export function TabBar<T extends string>({
  items,
  value,
  onChange,
  label = "Page sections",
}: {
  items: ReadonlyArray<readonly [T, React.ReactNode]>;
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex max-w-full overscroll-x-contain overflow-x-auto border-b border-border"
    >
      {items.map(([key, itemLabel], index) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          tabIndex={value === key ? 0 : -1}
          onClick={() => onChange(key)}
          onKeyDown={event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const nextIndex =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? items.length - 1
                  : event.key === "ArrowRight"
                    ? (index + 1) % items.length
                    : (index - 1 + items.length) % items.length;
            const nextItem = items[nextIndex];
            if (!nextItem) return;
            onChange(nextItem[0]);
            const tabs =
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                '[role="tab"]'
              );
            tabs?.[nextIndex]?.focus();
          }}
          className={`-mb-px inline-flex min-h-10 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium outline-none transition-[border-color,color] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 sm:px-4 ${
            value === key
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {itemLabel}
        </button>
      ))}
    </div>
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
  tone = "neutral",
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "neutral" | "positive" | "warning" | "critical" | "info";
  href?: string;
}) {
  const toneClasses: Record<string, string> = {
    neutral: "border-border bg-card",
    positive: "border-primary/15 bg-primary/[0.035]",
    warning: "border-warning/20 bg-warning-surface/70",
    critical: "border-error/20 bg-error-surface/70",
    info: "border-border bg-surface-subtle/70",
  };

  const body = (
    <div
      className={`flex min-h-[7.5rem] min-w-0 flex-col rounded-xl border p-4 shadow-sm shadow-foreground/[0.02] transition-[background-color,border-color,box-shadow,transform] duration-150 ${toneClasses[tone]} ${href ? "hover:-translate-y-0.5 hover:border-primary/25 hover:bg-surface-subtle hover:shadow-md" : ""}`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p
        className="mt-3 truncate text-2xl font-semibold leading-none tracking-tight tabular-nums text-foreground"
        title={
          typeof value === "string" || typeof value === "number"
            ? String(value)
            : undefined
        }
      >
        {value}
      </p>
      {hint && (
        <p className="mt-2 text-xs leading-4 text-muted-foreground">{hint}</p>
      )}
    </div>
  );

  return href ? (
    <Link
      href={href}
      className="block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

const STATUS_TONES: Record<string, string> = {
  // Healthy / complete
  ACTIVE: "bg-success-surface text-success-foreground border-success/20",
  COMPLETED: "bg-success-surface text-success-foreground border-success/20",
  RECEIVED: "bg-success-surface text-success-foreground border-success/20",
  APPROVED: "bg-success-surface text-success-foreground border-success/20",
  PASS: "bg-success-surface text-success-foreground border-success/20",
  ISSUED: "bg-success-surface text-success-foreground border-success/20",
  SHIPPED: "bg-success-surface text-success-foreground border-success/20",
  CONVERTED: "bg-success-surface text-success-foreground border-success/20",
  RESOLVED: "bg-success-surface text-success-foreground border-success/20",
  AVAILABLE: "bg-success-surface text-success-foreground border-success/20",

  // In flight
  IN_PROGRESS: "bg-info-surface text-info-foreground border-info/20",
  RELEASED: "bg-info-surface text-info-foreground border-info/20",
  SENT: "bg-info-surface text-info-foreground border-info/20",
  ACKNOWLEDGED: "bg-info-surface text-info-foreground border-info/20",
  PARTIALLY_RECEIVED: "bg-info-surface text-info-foreground border-info/20",
  PARTIALLY_ISSUED: "bg-info-surface text-info-foreground border-info/20",
  PARTIALLY_CONVERTED: "bg-info-surface text-info-foreground border-info/20",
  PICKED: "bg-info-surface text-info-foreground border-info/20",
  PACKED: "bg-info-surface text-info-foreground border-info/20",
  ASSIGNED: "bg-info-surface text-info-foreground border-info/20",
  QC_IN_PROGRESS: "bg-info-surface text-info-foreground border-info/20",

  // Waiting
  DRAFT: "bg-secondary text-secondary-foreground border-border",
  PENDING: "bg-warning-surface text-warning-foreground border-warning/20",
  PENDING_APPROVAL:
    "bg-warning-surface text-warning-foreground border-warning/20",
  PENDING_QC: "bg-warning-surface text-warning-foreground border-warning/20",
  SUBMITTED: "bg-warning-surface text-warning-foreground border-warning/20",
  PLANNED: "bg-warning-surface text-warning-foreground border-warning/20",
  OPEN: "bg-warning-surface text-warning-foreground border-warning/20",
  ACKNOWLEDGED_ALERT:
    "bg-warning-surface text-warning-foreground border-warning/20",
  ON_HOLD: "bg-warning-surface text-warning-foreground border-warning/20",
  CONDITIONAL_PASS:
    "bg-warning-surface text-warning-foreground border-warning/20",
  QUARANTINE: "bg-warning-surface text-warning-foreground border-warning/20",

  // Trouble
  REJECTED: "bg-error-surface text-error-foreground border-error/20",
  FAIL: "bg-error-surface text-error-foreground border-error/20",
  CANCELLED: "bg-error-surface text-error-foreground border-error/20",
  BLACKLISTED: "bg-error-surface text-error-foreground border-error/20",
  EXPIRED: "bg-error-surface text-error-foreground border-error/20",
  BLOCKED: "bg-error-surface text-error-foreground border-error/20",
  DAMAGED: "bg-error-surface text-error-foreground border-error/20",

  // Retired
  OBSOLETE: "bg-secondary text-muted-foreground border-border",
  CLOSED: "bg-secondary text-muted-foreground border-border",
  INACTIVE: "bg-secondary text-muted-foreground border-border",
  CONSUMED: "bg-secondary text-muted-foreground border-border",
  DISMISSED: "bg-secondary text-muted-foreground border-border",
};

export function StatusBadge({
  status,
  className = "",
}: {
  status: string | null | undefined;
  className?: string;
}) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const tone =
    STATUS_TONES[status] ??
    "bg-secondary text-secondary-foreground border-border";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${tone} ${className}`}
    >
      {humanizeEnum(status)}
    </span>
  );
}

const SEVERITY_TONES: Record<string, string> = {
  CRITICAL: "bg-error text-white border-error",
  HIGH: "bg-error-surface text-error-foreground border-error/20",
  MEDIUM: "bg-warning-surface text-warning-foreground border-warning/20",
  LOW: "bg-secondary text-secondary-foreground border-border",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${
        SEVERITY_TONES[severity] ?? SEVERITY_TONES.LOW
      }`}
    >
      {humanizeEnum(severity)}
    </span>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-border bg-card shadow-sm shadow-foreground/[0.02] ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-col items-start gap-3 border-b border-border px-4 pb-3 pt-4 sm:px-5 sm:pt-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 lg:shrink-0">
            {title && (
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex w-full min-w-0 flex-1 flex-wrap items-center gap-2 lg:justify-end">
              {actions}
            </div>
          )}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/**
 * Simple table shell. The data-heavy screens here need dense, scrollable
 * tables with sticky headers rather than the card-styled CRM table.
 */
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
      <div
        className="space-y-2 py-4"
        role="status"
        aria-label="Loading table data"
      >
        <span className="sr-only">Loading table data…</span>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-9 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>
    );
  }

  return (
    <div className="max-w-full overscroll-x-contain overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
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
  totalItems,
  onChange,
}: {
  page: number;
  totalPages: number | undefined;
  totalItems: number | undefined;
  onChange: (page: number) => void;
}) {
  const pages = totalPages ?? 1;
  if (pages <= 1) {
    return totalItems !== undefined ? (
      <p className="px-1 py-2 text-xs text-muted-foreground">
        {totalItems} record(s)
      </p>
    ) : null;
  }

  return (
    <div className="flex flex-col gap-3 px-1 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        Page {page} of {pages}
        {totalItems !== undefined ? ` · ${totalItems} record(s)` : ""}
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

/** Consistent surface for an API failure, including the server's message. */
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

/** Empty-state that tells the user what to do next rather than just "no data". */
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
