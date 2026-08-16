"use client";

import React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@repo/ui/lib/utils";

interface LineChartProps {
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      borderColor?: string;
      backgroundColor?: string;
    }>;
  };
  title?: string;
  subtitle?: string;
  className?: string;
  showLegend?: boolean;
  showGrid?: boolean;
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.12)",
  fontSize: 12,
};

export function LineChart({
  data,
  title,
  subtitle,
  className,
  showLegend = false,
  showGrid = true,
}: LineChartProps) {
  const rows = data.labels.map((label, index) => ({
    label,
    ...Object.fromEntries(
      data.datasets.map((dataset, datasetIndex) => [
        `series${datasetIndex}`,
        Number(dataset.data[index] ?? 0),
      ])
    ),
  }));

  return (
    <div className={cn("flex h-full w-full flex-col", className)}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart
            data={rows}
            margin={{ top: 8, right: 10, left: -22, bottom: 0 }}
          >
            {showGrid && (
              <CartesianGrid
                strokeDasharray="4 5"
                vertical={false}
                stroke="var(--border)"
                opacity={0.65}
              />
            )}
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickMargin={8}
            />
            <Tooltip
              cursor={{
                stroke: "#ED1C24",
                strokeDasharray: "4 4",
                opacity: 0.35,
              }}
              contentStyle={tooltipStyle}
            />
            {showLegend && (
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12 }}
              />
            )}
            {data.datasets.map((dataset, index) => (
              <Line
                key={`${dataset.label}-${index}`}
                type="monotone"
                dataKey={`series${index}`}
                name={dataset.label}
                stroke={dataset.borderColor || "#ED1C24"}
                strokeWidth={3}
                dot={{
                  r: 3,
                  fill: dataset.borderColor || "#ED1C24",
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 6,
                  fill: dataset.borderColor || "#ED1C24",
                  stroke: "#fff",
                  strokeWidth: 3,
                }}
                animationDuration={700}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
