import * as React from "react";

import { cn } from "@repo/ui/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      role="presentation"
      className={cn(
        "motion-safe:animate-pulse rounded-md bg-skeleton",
        className
      )}
      {...props}
    />
  );
}

export function SkeletonRegion({
  label = "Loading",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
      className={className}
    >
      {children}
    </div>
  );
}

export function SkeletonText({
  className,
  lines = 1,
}: {
  className?: string;
  lines?: number;
}) {
  if (lines === 1)
    return <Skeleton className={cn("h-3.5 w-full", className)} />;
  return (
    <div className="space-y-1.5">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn(
            "h-3.5",

            index === lines - 1 ? "w-2/3" : "w-full",
            className
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonTableRows({
  rows = 8,
  columns = 5,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className={cn("border-b border-border", className)}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="h-11 px-3 align-middle">
              <Skeleton
                className={cn(
                  "h-3.5",

                  colIndex === 0
                    ? "w-3/4"
                    : colIndex % 3 === 0
                      ? "w-1/2"
                      : "w-2/3"
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonMetricCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-xl border border-border bg-card p-3.5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="size-7 rounded-md" />
      </div>
      <Skeleton className="mt-2.5 h-7 w-32" />
      <Skeleton className="mt-1.5 h-3 w-20" />
    </div>
  );
}

export function SkeletonMetricRow({ count = 4 }: { count?: number }) {
  return (
    <SkeletonRegion label="Loading metrics" className="grid-auto-fit gap-3">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonMetricCard key={index} />
      ))}
    </SkeletonRegion>
  );
}

export function SkeletonChart({
  height = 200,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <SkeletonRegion label="Loading chart" className={cn("w-full", className)}>
      <div className="flex w-full items-end gap-2" style={{ height }}>
        {[62, 84, 48, 96, 70, 55, 88].map((pct, index) => (
          <Skeleton
            key={index}
            className="w-full rounded-sm"
            style={{ height: `${pct}%` }}
          />
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function SkeletonPerson({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Skeleton
        className={cn("shrink-0 rounded-full", compact ? "size-7" : "size-9")}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className={cn("h-3.5", compact ? "w-24" : "w-32")} />
        <Skeleton className={cn("h-3", compact ? "w-16" : "w-24")} />
      </div>
    </div>
  );
}

export function SkeletonMenuRows({ rows = 4 }: { rows?: number }) {
  return (
    <SkeletonRegion label="Loading options" className="space-y-1 p-1">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-7 w-full" />
      ))}
    </SkeletonRegion>
  );
}

export function SkeletonFields({
  fields = 4,
  columns = 1,
}: {
  fields?: number;
  columns?: number;
}) {
  return (
    <SkeletonRegion
      label="Loading form"
      className={cn(
        "grid gap-3",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-3"
      )}
    >
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

export function SkeletonList({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <SkeletonRegion label="Loading list" className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </SkeletonRegion>
  );
}
