"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { LineChart } from "@repo/ui";
import { DonutChart } from "@repo/ui";
import {
  useLeadsGeneratedOverTime,
  useConversionRate,
  useLeadSources,
} from "../hooks/useDashboard";
import { ChartSkeleton } from "./skeletons";

/**
 * Analytics cards for the operations dashboard.
 *
 * These deliberately pass no colours down. The chart components read the
 * `--chart-*` tokens, which are defined once per theme, so a series looks
 * right in light and dark without either being restated here. An earlier
 * version pinned brand red on the trend line and a six-hue accent palette on
 * the donuts, which overrode the token ramp at the call site — the charts kept
 * the old look no matter what the components did, and the near-white segment
 * ring vanished against a dark surface.
 */

/** One card shell, so loading / error / loaded cannot drift apart. */
function ChartCard({
  title,
  height,
  isLoading,
  error,
  children,
}: {
  title: string;
  height: string;
  isLoading: boolean;
  error: unknown;
  children: React.ReactNode;
}) {
  return (
    <Card className="h-full transition-[border-color,box-shadow] duration-200 hover:border-border-strong">
      <CardHeader>
        <CardTitle className="text-sm font-semibold leading-5 tracking-tight text-foreground">
          {title}
        </CardTitle>
        <p className="text-xs leading-4 text-muted-foreground">
          Updates daily at 2 AM IST
        </p>
      </CardHeader>
      <CardContent
        className={
          isLoading || error
            ? `${height} flex items-center justify-center`
            : height
        }
      >
        {isLoading ? (
          <ChartSkeleton height={180} />
        ) : error ? (
          <p className="text-sm text-muted-foreground">Unable to load data.</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

type ChartInput = {
  labels: string[];
  datasets: Array<{ label: string; data: number[] }>;
};

const EMPTY: ChartInput = { labels: [], datasets: [] };

/**
 * Keeps only the labels and the numbers.
 *
 * The API's dataset type carries `borderColor`/`backgroundColor`, which are a
 * leftover from when the palette was decided per request. Dropping them here is
 * what makes the `--chart-*` tokens authoritative — and it is a compile-time
 * guarantee rather than a convention, because the chart components never see a
 * colour to prefer.
 */
function toChartInput(source?: {
  labels?: string[];
  datasets?: Array<{ label?: string; data?: number[] }>;
}): ChartInput {
  if (!source) return EMPTY;
  return {
    labels: source.labels ?? [],
    datasets: (source.datasets ?? []).map(dataset => ({
      label: dataset.label ?? "",
      data: dataset.data ?? [],
    })),
  };
}

export function LeadsGeneratedCard() {
  const { data, isLoading, error } = useLeadsGeneratedOverTime({
    period: "week",
  });

  return (
    <ChartCard
      title="Leads Generated"
      height="h-[12.5rem]"
      isLoading={isLoading}
      error={error}
    >
      <LineChart
        data={toChartInput(data)}
        className="h-full"
        showLegend={false}
      />
    </ChartCard>
  );
}

export function ConversionRateCard() {
  const { data, isLoading, error } = useConversionRate();

  return (
    <ChartCard
      title="Conversion Rate"
      height="h-[15rem]"
      isLoading={isLoading}
      error={error}
    >
      <DonutChart
        data={toChartInput(data)}
        className="h-full"
        showLegend
        legendPosition="bottom"
      />
    </ChartCard>
  );
}

export function LeadSourcesCard() {
  const { data, isLoading, error } = useLeadSources();

  return (
    <ChartCard
      title="Lead Sources"
      height="h-[15rem]"
      isLoading={isLoading}
      error={error}
    >
      <DonutChart
        data={toChartInput(data)}
        className="h-full"
        showLegend
        legendPosition="bottom"
      />
    </ChartCard>
  );
}

export function AnalyticsOverview() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <LeadsGeneratedCard />
      <ConversionRateCard />
      <LeadSourcesCard />
    </div>
  );
}
