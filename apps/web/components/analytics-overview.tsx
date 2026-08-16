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

// Donut charts use the brand guideline 3.4 Accent Palette (Use sparingly).
const BRAND_CHART_COLORS = [
  "#FFB020", // Amber
  "#00B7FF", // Sky Blue
  "#6C5CE7", // Purple
  "#FF4D9D", // Pink
  "#FF7A59", // Coral
  "#7ED957", // Lime
];

function DashboardCardHeader({ title }: { title: string }) {
  return (
    <CardHeader>
      <CardTitle className="text-base font-bold text-primary">
        {title}
      </CardTitle>
      <p className="text-xs text-muted-foreground">Updates daily at 2 AM IST</p>
    </CardHeader>
  );
}

// Leads Generated Card Component
export function LeadsGeneratedCard() {
  const {
    data: leadsData,
    isLoading,
    error,
  } = useLeadsGeneratedOverTime({ period: "week" });

  // Apply the Ralli Wolf red line and soft red fill without changing API data.
  const chartData = leadsData
    ? {
        ...leadsData,
        datasets: (leadsData.datasets || []).map(dataset => ({
          ...dataset,
          borderColor: "#ED1C24",
          backgroundColor: "rgba(237, 28, 36, 0.10)",
          pointBackgroundColor: "#ED1C24",
          pointBorderColor: "#ffffff",
          fill: true,
          tension: 0.4,
        })),
      }
    : { labels: [], datasets: [] };

  if (isLoading) {
    return (
      <Card className="h-full transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-md">
        <DashboardCardHeader title="Leads Generated" />
        <CardContent className="h-[200px] flex items-center justify-center">
          <ChartSkeleton height={180} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-md">
        <DashboardCardHeader title="Leads Generated" />
        <CardContent className="h-[200px] flex items-center justify-center">
          <div>Error loading data</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-md">
      <DashboardCardHeader title="Leads Generated" />
      <CardContent className="h-[200px]">
        <LineChart data={chartData} className="h-full" showLegend={false} />
      </CardContent>
    </Card>
  );
}

// Conversion Rate Card Component
export function ConversionRateCard() {
  const { data: conversionData, isLoading, error } = useConversionRate();

  const chartData = conversionData
    ? {
        ...conversionData,
        datasets:
          conversionData.datasets?.map(dataset => ({
            ...dataset,
            backgroundColor: BRAND_CHART_COLORS.slice(
              0,
              dataset.data?.length || 0
            ),
            borderColor: "#F7FAFC",
            borderWidth: 2,
          })) || [],
      }
    : { labels: [], datasets: [] };

  if (isLoading) {
    return (
      <Card className="h-full transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-md">
        <DashboardCardHeader title="Conversion Rate" />
        <CardContent className="h-[240px] flex items-center justify-center">
          <ChartSkeleton height={200} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-md">
        <DashboardCardHeader title="Conversion Rate" />
        <CardContent className="h-[240px] flex items-center justify-center">
          <div>Error loading data</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-md">
      <DashboardCardHeader title="Conversion Rate" />
      <CardContent className="h-[240px]">
        <DonutChart
          data={chartData}
          className="h-full"
          showLegend={true}
          legendPosition="bottom"
        />
      </CardContent>
    </Card>
  );
}

// Lead Sources Card Component
export function LeadSourcesCard() {
  const { data: sourcesData, isLoading, error } = useLeadSources();

  const chartData = sourcesData
    ? {
        ...sourcesData,
        datasets:
          sourcesData.datasets?.map(dataset => ({
            ...dataset,
            backgroundColor: BRAND_CHART_COLORS.slice(
              0,
              dataset.data?.length || 0
            ),
            borderColor: "#F7FAFC",
            borderWidth: 2,
          })) || [],
      }
    : { labels: [], datasets: [] };

  if (isLoading) {
    return (
      <Card className="h-full transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-md">
        <DashboardCardHeader title="Lead Sources" />
        <CardContent className="h-[240px] flex items-center justify-center">
          <ChartSkeleton height={200} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-md">
        <DashboardCardHeader title="Lead Sources" />
        <CardContent className="h-[240px] flex items-center justify-center">
          <div>Error loading data</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-md">
      <DashboardCardHeader title="Lead Sources" />
      <CardContent className="h-[240px]">
        <DonutChart
          data={chartData}
          className="h-full"
          showLegend={true}
          legendPosition="bottom"
        />
      </CardContent>
    </Card>
  );
}

// Analytics Overview Component
export function AnalyticsOverview() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <LeadsGeneratedCard />
      <ConversionRateCard />
      <LeadSourcesCard />
    </div>
  );
}
