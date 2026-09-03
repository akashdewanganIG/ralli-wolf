"use client";

import React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@repo/ui/lib/utils";

interface DonutChartProps {
  data: {
    labels: string[];
    datasets: Array<{ data: number[]; backgroundColor?: string[] }>;
  };
  title?: string;
  subtitle?: string;
  className?: string;
  showLegend?: boolean;
  legendPosition?: "top" | "bottom" | "left" | "right";
}

const SEGMENT_COLORS = [
  "var(--chart-step-2)",
  "var(--chart-step-3)",
  "var(--chart-step-4)",
  "var(--chart-step-5)",
  "var(--chart-step-1)",
];

export function DonutChart({
  data,
  title,
  subtitle,
  className,
  showLegend = true,
  legendPosition = "bottom",
}: DonutChartProps) {
  const values = data.datasets[0]?.data ?? [];
  const colors = data.datasets[0]?.backgroundColor ?? [];

  const rows = data.labels.map((name, index) => ({
    name,
    value: Number(values[index] ?? 0),
    color: colors[index] || SEGMENT_COLORS[index % SEGMENT_COLORS.length],
  }));
  const total = rows.reduce((sum, item) => sum + item.value, 0);
  const isSide = legendPosition === "left" || legendPosition === "right";

  const legend = showLegend ? (
    <div
      className={cn(
        isSide
          ? "grid min-w-36 gap-3"
          : "mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5"
      )}
    >
      {rows.map(item => (
        <div key={item.name} className="flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-xs font-semibold tabular-nums text-foreground">
            {total ? Math.round((item.value / total) * 100) : 0}%
          </span>
          <span className="text-xs text-muted-foreground">{item.name}</span>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div className={cn("flex h-full w-full flex-col", className)}>
      {(title || subtitle) && (
        <div className="mb-4 text-center">
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
      <div
        className={cn(
          "min-h-0 flex-1",
          isSide ? "flex items-center gap-4" : "flex flex-col",
          legendPosition === "left" && "flex-row-reverse"
        )}
      >
        <div className="relative min-h-0 min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="name"
                innerRadius="63%"
                outerRadius="88%"
                paddingAngle={2}
                cornerRadius={4}
                stroke="transparent"
                animationDuration={750}
              >
                {rows.map(item => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  `${Number(value).toLocaleString()} (${total ? ((Number(value) / total) * 100).toFixed(1) : 0}%)`,
                  name,
                ]}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--popover)",
                  boxShadow: "0 8px 24px rgb(0 0 0 / 0.12)",
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold tabular-nums text-foreground">
              {total.toLocaleString()}
            </span>
            <span className="text-[0.6875rem] uppercase tracking-widest text-muted-foreground">
              Total
            </span>
          </div>
        </div>
        {legend}
      </div>
    </div>
  );
}
