"use client";

import React from "react";
import { cn } from "@repo/ui/lib/utils";

export { Skeleton } from "@repo/ui/components/ui/skeleton";
export {
  SkeletonRegion,
  SkeletonText,
  SkeletonTableRows,
  SkeletonMetricCard,
  SkeletonMetricRow,
  SkeletonChart,
  SkeletonPerson,
  SkeletonMenuRows,
  SkeletonFields,
  SkeletonList,
} from "@repo/ui/components/ui/skeleton";

import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { PageShell } from "@repo/ui/components/ui/page-shell";

type SkeletonProps = React.ComponentProps<typeof Skeleton>;

export const ToolbarSkeleton: React.FC = () => (
  <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center gap-3">
      <Skeleton className="h-10 w-full md:w-72" />
      <Skeleton className="h-10 w-24" />
      <Skeleton className="h-10 w-24" />
      <Skeleton className="h-10 w-24" />
      <Skeleton className="h-10 w-24" />
    </div>
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 4 }).map((_, idx) => (
        <Skeleton key={idx} className="h-8 w-24 rounded-full" />
      ))}
    </div>
  </div>
);

export const TableRowSkeleton: React.FC = () => (
  <div className="grid grid-cols-3 gap-4 rounded-md border px-4 py-3 sm:grid-cols-6">
    <Skeleton className="col-span-2 h-4" />
    <Skeleton className="h-4" />
    <Skeleton className="h-4" />
    <Skeleton className="h-4" />
    <Skeleton className="h-4" />
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 8 }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, idx) => (
      <TableRowSkeleton key={idx} />
    ))}
  </div>
);

export const SummaryCardSkeleton: React.FC = () => (
  <div className="rounded-xl border bg-card p-4">
    <Skeleton className="mb-2 h-4 w-24" />
    <Skeleton className="mb-1 h-8 w-40" />
    <Skeleton className="h-4 w-16" />
  </div>
);

export const DetailHeaderSkeleton: React.FC = () => (
  <div className="rounded-xl border bg-card p-4">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  </div>
);

export const DetailSidebarSkeleton: React.FC<{ items?: number }> = ({
  items = 5,
}) => (
  <div className="rounded-xl border bg-card p-4">
    <Skeleton className="mb-4 h-5 w-32" />
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, idx) => (
        <div key={idx} className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  </div>
);

export const ActivityFeedSkeleton: React.FC<{ items?: number }> = ({
  items = 4,
}) => (
  <div className="rounded-xl border bg-card p-4">
    <Skeleton className="mb-4 h-5 w-40" />
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, idx) => (
        <div key={idx} className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  </div>
);

export const ListSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, idx) => (
      <div key={idx} className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
    ))}
  </div>
);

export const StatGridSkeleton: React.FC<{ count?: number }> = ({
  count = 4,
}) => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: count }).map((_, idx) => (
      <SummaryCardSkeleton key={idx} />
    ))}
  </div>
);

export const ChartSkeleton: React.FC<{ height?: number }> = ({
  height = 200,
}) => <Skeleton className="w-full rounded-xl" style={{ height }} />;

export const SkeletonLine: React.FC<SkeletonProps> = props => (
  <Skeleton className="h-4 w-full" {...props} />
);

export const SectionSkeleton: React.FC<{
  titleWidth?: string;
  children?: React.ReactNode;
}> = ({ titleWidth = "w-48", children }) => (
  <div className="space-y-4 rounded-xl border bg-card p-4">
    <Skeleton className={`h-5 ${titleWidth}`} />
    {children ?? <Skeleton className="h-24 w-full" />}
  </div>
);

export const PageHeaderSkeleton: React.FC<{ actions?: number }> = ({
  actions = 1,
}) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0 flex-1 space-y-2">
      <Skeleton className="h-7 w-52 max-w-full" />
      <Skeleton className="h-4 w-[30rem] max-w-full" />
    </div>
    {actions > 0 ? (
      <div className="flex gap-2">
        {Array.from({ length: actions }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-28" />
        ))}
      </div>
    ) : null}
  </div>
);

export const TablePageSkeleton: React.FC<{
  rows?: number;
  filters?: number;
}> = ({ rows = 7, filters = 3 }) => (
  <PageShell role="status" aria-label="Loading page">
    <PageHeaderSkeleton />
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row">
        <Skeleton className="h-10 min-w-0 flex-1" />
        {Array.from({ length: filters }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full md:w-32" />
        ))}
      </div>
      <div className="rounded-xl border bg-card p-4">
        <TableSkeleton rows={rows} />
      </div>
    </div>
    <span className="sr-only">Loading…</span>
  </PageShell>
);

export const DetailPageSkeleton: React.FC = () => (
  <PageShell role="status" aria-label="Loading details">
    <PageHeaderSkeleton actions={2} />
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <SectionSkeleton>
          <TableSkeleton rows={5} />
        </SectionSkeleton>
        <SectionSkeleton />
      </div>
      <DetailSidebarSkeleton />
    </div>
    <span className="sr-only">Loading details…</span>
  </PageShell>
);
