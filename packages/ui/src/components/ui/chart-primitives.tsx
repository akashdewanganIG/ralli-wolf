"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@repo/ui/lib/utils";

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 };

type TooltipRow = {
  label: string;
  value: string;
  color?: string;
};

function TooltipShell({
  heading,
  rows,
}: {
  heading?: string;
  rows: TooltipRow[];
}) {
  return (
    <div className="min-w-40 max-w-[16rem] rounded-lg border border-border bg-popover/95 px-3 py-2 text-xs shadow-lg shadow-black/10 backdrop-blur">
      {heading ? (
        <p className="mb-1 font-semibold text-foreground">{heading}</p>
      ) : null}
      <div className="space-y-1">
        {rows.map(row => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4"
          >
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              {row.color ? (
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
              ) : null}
              <span className="truncate">{row.label}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-foreground">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryTooltip({
  valueLabel,
  active,
  payload,
}: {
  valueLabel: string;
  active?: boolean;
  payload?: Array<{ payload?: CategoryDatum }>;
}) {
  const entry = payload?.[0]?.payload;
  if (!active || !entry) return null;
  return (
    <TooltipShell
      heading={entry.name}
      rows={[
        {
          label: valueLabel,
          value: entry.display,
          color: "var(--chart-mark)",
        },
        ...(entry.detail ?? []).map(row => ({
          label: row.label,
          value: row.value,
        })),
      ]}
    />
  );
}

export type CategoryDatum = {
  name: string;

  value: number;

  display: string;

  detail?: Array<{ label: string; value: string }>;
};

const HOVER_FILL = "color-mix(in srgb, var(--chart-track) 45%, transparent)";

const NAME_WIDTH = 148;

const ROW_HEIGHT = 32;
const BAR_SIZE = 13;

const XAXIS_HEIGHT = 0;

const VALUE_INSET = 64;

const MAX_VISIBLE_ROWS = 10;

const HATCH_CSS =
  "repeating-linear-gradient(45deg, var(--chart-mark-hatch) 0 1px, transparent 1px 7px), " +
  "repeating-linear-gradient(-45deg, var(--chart-mark-hatch) 0 1px, transparent 1px 7px)";
const HATCH_ID = "rw-column-hatch";

function ColumnHatch() {
  return (
    <defs>
      <pattern id={HATCH_ID} patternUnits="userSpaceOnUse" width="7" height="7">
        <rect width="7" height="7" fill="var(--chart-mark)" />
        <path
          d="M0 7 L7 0 M-1 1 L1 -1 M6 8 L8 6 M0 0 L7 7 M-1 6 L1 8 M6 -1 L8 1"
          stroke="var(--chart-mark-hatch)"
          strokeWidth="1"
          shapeRendering="crispEdges"
        />
      </pattern>
    </defs>
  );
}

type BarShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  series: CategoryDatum[];
};

function BarMark({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  index = 0,
  series,
}: BarShapeProps) {
  const datum = series[index];
  if (!datum || width <= 0 || height <= 0) return null;

  const cap = Math.min(2, width);
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={`url(#${HATCH_ID})`}
      />
      <rect
        x={x + width - cap}
        y={y}
        width={cap}
        height={height}
        fill="var(--chart-accent)"
      />
    </g>
  );
}

export function CategoryBarChart({
  data,
  className,
  valueLabel = "Value",
  maxVisibleRows = MAX_VISIBLE_ROWS,
}: {
  data: CategoryDatum[];
  className?: string;
  valueLabel?: string;

  maxVisibleRows?: number;
}) {
  const rows = data.length;

  const plotHeight = rows * ROW_HEIGHT + XAXIS_HEIGHT;
  const visibleHeight =
    Math.min(rows, maxVisibleRows) * ROW_HEIGHT + XAXIS_HEIGHT;

  return (
    <div
      className={cn(
        "w-full overflow-y-auto overscroll-y-contain",

        className
      )}
      style={{ maxHeight: visibleHeight }}
    >
      <div style={{ height: plotHeight, minWidth: NAME_WIDTH + 160 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: VALUE_INSET, left: 0, bottom: 0 }}
            barSize={BAR_SIZE}
          >
            <ColumnHatch />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={NAME_WIDTH}
              axisLine={false}
              tickLine={false}
              tick={AXIS_TICK}
              interval={0}
            />

            <Tooltip
              cursor={{ fill: HOVER_FILL }}
              content={<CategoryTooltip valueLabel={valueLabel} />}
            />
            <Bar
              dataKey="value"
              isAnimationActive={false}
              shape={props => <BarMark {...props} series={data} />}
            >
              <LabelList
                dataKey="display"
                position="right"
                offset={8}
                className="fill-foreground text-[12px] font-semibold tabular-nums"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export type MagnitudeDatum = {
  key: string;

  label: string;

  value: number;

  display: string;

  meta?: string;
};

export function MagnitudeBars({
  data,
  className,
}: {
  data: MagnitudeDatum[];
  className?: string;
}) {
  const max = Math.max(1, ...data.map(datum => datum.value));

  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {data.map(datum => (
        <li key={datum.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-xs">
              <span className="font-medium text-foreground">{datum.label}</span>
              {datum.meta ? (
                <span className="text-muted-foreground"> · {datum.meta}</span>
              ) : null}
            </span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
              {datum.display}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 w-full bg-chart-track">
            <div
              className="h-full border-r-2 border-chart-accent"
              style={{
                width: `${Math.max(1.5, (datum.value / max) * 100)}%`,
                backgroundColor: "var(--chart-mark)",
                backgroundImage: HATCH_CSS,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RatioGauge({
  value,
  caption,
  size = 148,
  className,
  emphasis = "neutral",
}: {
  value: number;
  caption?: React.ReactNode;
  size?: number;
  className?: string;

  emphasis?: "neutral" | "warning";
}) {
  const safe = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const sweep = 0.75;
  const arcLength = circumference * sweep;
  const arcColor =
    emphasis === "warning" ? "var(--warning)" : "var(--chart-mark)";

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${Math.round(safe)} percent`}
          style={{ transform: "rotate(135deg)" }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--chart-track)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
          />

          {safe > 0 ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arcColor}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${(arcLength * safe) / 100} ${circumference}`}
              style={{ transition: "stroke-dasharray 500ms ease-out" }}
            />
          ) : null}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold leading-none tabular-nums text-foreground">
            {Math.round(safe)}
            <span className="text-base font-medium text-muted-foreground">
              %
            </span>
          </span>
        </div>
      </div>
      {caption ? (
        <p className="mt-2 text-center text-xs leading-4 text-muted-foreground">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

export type CompositionSegment = {
  key: string;
  label: string;
  value: number;
  display: string;

  meta?: string;
};

const STEP_TOKENS = [
  "var(--chart-step-1)",
  "var(--chart-step-2)",
  "var(--chart-step-3)",
  "var(--chart-step-4)",
  "var(--chart-step-5)",
];

export function CompositionBar({
  segments,
  total,
  className,
}: {
  segments: CompositionSegment[];

  total?: string;
  className?: string;
}) {
  const sum = segments.reduce((acc, segment) => acc + segment.value, 0);
  const visible = segments.filter(segment => segment.value > 0);

  return (
    <div className={cn("flex flex-col", className)}>
      {total ? (
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="text-xs text-muted-foreground">Committed value</span>
          <span className="text-lg font-semibold leading-none tabular-nums text-foreground">
            {total}
          </span>
        </div>
      ) : null}

      <div
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-chart-track"
        role="img"
        aria-label={visible
          .map(segment => `${segment.label}: ${segment.display}`)
          .join(", ")}
      >
        {visible.map((segment, index) => (
          <span
            key={segment.key}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${sum ? (segment.value / sum) * 100 : 0}%`,
              backgroundColor: STEP_TOKENS[index % STEP_TOKENS.length],
            }}
          />
        ))}
      </div>

      <ul className="mt-3 space-y-2">
        {segments.map((segment, index) => (
          <li
            key={segment.key}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{
                  backgroundColor: STEP_TOKENS[index % STEP_TOKENS.length],
                }}
              />
              <span className="truncate text-foreground">{segment.label}</span>
              {segment.meta ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {segment.meta}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-muted-foreground">
              {segment.display}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
