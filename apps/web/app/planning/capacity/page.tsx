"use client";

import * as React from "react";

import { Button } from "@repo/ui/components/ui/button";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { Skeleton, SkeletonRegion } from "@repo/ui/components/ui/skeleton";
import { Tag } from "@repo/ui/components/ui/tag";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  ErrorBanner,
  PageHeader,
  Panel,
  StatCard,
} from "@/components/supply-chain/shared";
import { useCapacityLoad } from "@/hooks/useFinance";
import type { CapacityRow } from "@/lib/api/financeServices";

const WINDOWS = [7, 14, 30] as const;

/** A short day label — the header of the load grid has no room for more. */
function dayLabel(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/**
 * One work centre's load across the window. A cell is a day: the fuller it is,
 * the darker it reads, and anything past 100% is called out in the accent
 * colour, because that is the day someone has to move work off.
 */
function LoadRow({ row }: { row: CapacityRow }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="min-w-[11rem] flex-1">
        <p className="text-sm font-medium text-foreground">
          {row.workCenter.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {row.workCenter.code} · {row.workCenter.warehouse} ·{" "}
          {Math.round((row.capacityMinutesPerDay / 60) * 10) / 10}h a day
        </p>
      </div>

      <div className="flex gap-[3px]">
        {row.days.map(day => (
          <div
            key={day.date}
            title={`${dayLabel(day.date)} — ${day.utilisationPercent}% booked (${Math.round((day.minutes / 60) * 10) / 10}h)`}
            className={
              day.overloaded
                ? "h-7 w-4 rounded-[3px] bg-primary"
                : day.utilisationPercent > 0
                  ? "h-7 w-4 rounded-[3px] bg-success"
                  : "h-7 w-4 rounded-[3px] bg-surface-secondary"
            }
            style={
              day.overloaded || day.utilisationPercent === 0
                ? undefined
                : // Below 100%, the bar is only as tall as the day is full —
                  // but a day with any work on it never reads as empty.
                  {
                    background: `linear-gradient(to top, var(--color-success) ${Math.max(day.utilisationPercent, 12)}%, var(--color-surface-secondary) ${Math.max(day.utilisationPercent, 12)}%)`,
                  }
            }
          />
        ))}
      </div>

      <div className="w-24 shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {row.utilisationPercent}%
        </p>
        <p className="text-xs text-muted-foreground">
          {Math.round((row.committedMinutes / 60) * 10) / 10}h booked
        </p>
      </div>

      <div className="w-24 shrink-0 text-right">
        {row.overloadedDays > 0 ? (
          <Tag tone="danger">{row.overloadedDays} day(s) over</Tag>
        ) : (
          <Tag tone="active">Fits</Tag>
        )}
      </div>
    </div>
  );
}

export default function CapacityPage() {
  const [days, setDays] = React.useState<number>(14);
  const { data, isLoading, error } = useCapacityLoad({ days });
  const unknown = isLoading || Boolean(error);
  const load = data?.data;
  const rows = load?.workCenters ?? [];

  const busiest = rows.reduce<CapacityRow | null>(
    (best, row) =>
      !best || row.utilisationPercent > best.utilisationPercent ? row : best,
    null
  );

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Capacity"
          subtitle="How much work is booked onto each machine and line, and whether it actually fits in the hours available."
        />

        <ErrorBanner error={error} />

        <div className="grid-auto-fit gap-3">
          <StatCard
            label="Work centres"
            value={unknown ? "—" : String(rows.length)}
            hint="Machines, lines and benches in use"
            tone="neutral"
          />
          <StatCard
            label="Steps booked in"
            value={unknown ? "—" : String(load?.scheduledOperations ?? 0)}
            hint={`Over the next ${days} days`}
            tone="info"
          />
          <StatCard
            label="Overloaded centres"
            value={unknown ? "—" : String(load?.overloadedCentres ?? 0)}
            hint="More work booked than hours available"
            tone={(load?.overloadedCentres ?? 0) > 0 ? "critical" : "positive"}
          />
          <StatCard
            label="Busiest centre"
            value={unknown || !busiest ? "—" : `${busiest.utilisationPercent}%`}
            hint={busiest ? busiest.workCenter.name : "Nothing booked"}
            tone={
              busiest && busiest.utilisationPercent > 100
                ? "critical"
                : "neutral"
            }
          />
        </div>

        <Panel
          flush
          title="Load by work centre"
          description="Each small bar is one day. A full accent-coloured bar means that day is booked beyond what the centre can do."
          actions={
            <div className="flex gap-2">
              {WINDOWS.map(w => (
                <Button
                  key={w}
                  type="button"
                  size="sm"
                  variant={days === w ? "default" : "outline"}
                  onClick={() => setDays(w)}
                >
                  {w} days
                </Button>
              ))}
            </div>
          }
        >
          {isLoading ? (
            <SkeletonRegion label="Loading capacity" className="max-w-full">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-[11rem] flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <div className="flex gap-[3px]">
                    {Array.from({ length: 14 }).map((__, d) => (
                      <Skeleton key={d} className="h-7 w-4 rounded-[3px]" />
                    ))}
                  </div>
                  <div className="w-24 shrink-0 space-y-2">
                    <Skeleton className="ml-auto h-4 w-12" />
                    <Skeleton className="ml-auto h-3 w-16" />
                  </div>
                  <div className="w-24 shrink-0">
                    <Skeleton className="ml-auto h-5 w-16 rounded-full" />
                  </div>
                </div>
              ))}
            </SkeletonRegion>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              {error
                ? "The capacity view could not be loaded."
                : "No work centres have been set up yet."}
            </p>
          ) : (
            <div className="max-w-full overflow-x-auto overscroll-x-contain">
              <div className="min-w-[46rem]">
                {rows.map(row => (
                  <LoadRow key={row.workCenter.id} row={row} />
                ))}
              </div>
            </div>
          )}
        </Panel>
      </PageShell>
    </ProtectedRoute>
  );
}
