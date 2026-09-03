"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { LineChart } from "@repo/ui";
import { DonutChart } from "@repo/ui";
import {
  useLeadsGeneratedOverTime,
  useConversionRate,
  useLeadSources,
} from "../hooks/use-dashboard";
import { ChartSkeleton } from "./skeletons";

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
