"use client";

import React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@repo/ui/lib/utils";

/**
 * Trend chart.
 *
 * Drawn as an area rather than a bare line: the soft fall-off under the curve
 * reads as magnitude at a glance, which a 1px stroke on its own does not.
 *
 * Colour comes from the `--chart-*` tokens, so both themes are correct from one
 * definition. Nothing here hard-codes a hex — an earlier version pinned the
 * brand red and white directly, which broke in dark mode.
 *
 * Axes carry no lines or ticks and the grid is horizontal only: at dashboard
 * size, chrome competes with the data it is supposed to frame.
 */
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

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 };

/** Ordinal ramp, so a second or third series stays distinguishable. */
const SERIES_COLORS = [
  "var(--chart-mark)",
  "var(--chart-step-4)",
  "var(--chart-step-2)",
];

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

  // Stable per-instance ids so two charts on one page cannot clash over a
  // shared gradient definition.
  const gradientId = React.useId();

  return (
    <div className={cn("flex h-full w-full flex-col", className)}>
      {(title || subtitle) && (
        <div className="mb-3">
          {title && (
            <h3 className="text-sm font-semibold leading-5 tracking-tight text-foreground">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={rows}
            margin={{ top: 8, right: 10, left: -22, bottom: 0 }}
          >
            <defs>
              {data.datasets.map((_, index) => {
                const color = SERIES_COLORS[index % SERIES_COLORS.length];
                return (
                  <linearGradient
                    key={index}
                    id={`${gradientId}-${index}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                );
              })}
            </defs>

            {showGrid && (
              <CartesianGrid
                vertical={false}
                stroke="var(--chart-grid)"
                strokeOpacity={0.7}
              />
            )}
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={AXIS_TICK}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              tick={AXIS_TICK}
              tickMargin={8}
              width={44}
            />
            <Tooltip
              cursor={{
                stroke: "var(--chart-mark)",
                strokeDasharray: "4 4",
                strokeOpacity: 0.5,
              }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--popover)",
                boxShadow: "0 8px 24px rgb(0 0 0 / 0.12)",
                fontSize: 12,
                padding: "8px 10px",
              }}
              labelStyle={{ color: "var(--muted-foreground)", fontSize: 11 }}
            />
            {showLegend && (
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12 }}
              />
            )}
            {data.datasets.map((dataset, index) => {
              const color =
                dataset.borderColor ??
                SERIES_COLORS[index % SERIES_COLORS.length];
              return (
                <Area
                  key={`${dataset.label}-${index}`}
                  type="monotone"
                  dataKey={`series${index}`}
                  name={dataset.label}
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#${gradientId}-${index})`}
                  // Only the hovered point is marked; a dot on every reading
                  // turns a trend line into a dotted mess at this width.
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: color,
                    stroke: "var(--surface)",
                    strokeWidth: 2,
                  }}
                  animationDuration={600}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
