"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@repo/ui/lib/utils";

/**
 * Dashboard chart primitives.
 *
 * Each form here exists because a specific shape of data needs it — a magnitude
 * comparison, a single ratio, a lifecycle composition. They deliberately do not
 * share one generic "bar" component, because the whole point is that the form
 * follows the data.
 *
 * Colour comes from the `--chart-*` tokens in globals.css, which are validated
 * against each mode's card surface. Nothing here hard-codes a hex, so both
 * themes stay correct from one definition.
 */

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 };
const GRID_STROKE = "var(--chart-grid)";

/** Recharts hands tooltip payloads back loosely typed; this is the shape we use. */
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

/**
 * Recharts clones the `content` element and injects `active`/`payload`, so this
 * is declared as a real component rather than an inline render callback.
 */
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
  /** Axis label. */
  name: string;
  /** Magnitude that sets bar length. */
  value: number;
  /** Preformatted value for the label and tooltip. */
  display: string;
  /** Optional extra tooltip rows, e.g. a secondary measure. */
  detail?: Array<{ label: string; value: string }>;
};

/**
 * Horizontal bars for comparing magnitude across named categories.
 *
 * Horizontal because the category names are words, not dates — they need room to
 * read. Every bar takes the same hue: the categories are nominal, so colouring
 * them individually would spend the identity channel re-encoding what bar length
 * already says.
 */
export function CategoryBarChart({
  data,
  className,
  height = 200,
  valueLabel = "Value",
}: {
  data: CategoryDatum[];
  className?: string;
  height?: number;
  valueLabel?: string;
}) {
  const labelWidth = Math.min(
    150,
    Math.max(84, ...data.map(row => row.name.length * 6.6))
  );

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 44, left: 0, bottom: 0 }}
          barCategoryGap="22%"
        >
          <CartesianGrid
            stroke={GRID_STROKE}
            strokeDasharray="3 3"
            horizontal={false}
          />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            width={labelWidth}
            tick={AXIS_TICK}
          />
          <Tooltip
            cursor={{ fill: "var(--chart-track)", opacity: 0.5 }}
            content={<CategoryTooltip valueLabel={valueLabel} />}
          />
          <Bar
            dataKey="value"
            fill="var(--chart-mark)"
            maxBarSize={18}
            radius={[0, 4, 4, 0]}
            animationDuration={700}
            animationEasing="ease-out"
            isAnimationActive={false}
          >
            <LabelList
              dataKey="display"
              position="right"
              offset={8}
              className="fill-muted-foreground"
              style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Radial gauge for a single ratio against a fixed limit.
 *
 * One number against 100% does not need an axis or a legend, so this draws the
 * arc directly rather than pulling in a chart engine. The value sits in the
 * middle at full size — the arc gives the reading its context, the number gives
 * the precision.
 */
export function RatioGauge({
  value,
  caption,
  size = 148,
  className,
  emphasis = "neutral",
}: {
  /** Percentage, 0-100. */
  value: number;
  caption?: React.ReactNode;
  size?: number;
  className?: string;
  /** `warning` re-colours the arc once the ratio is uncomfortably high. */
  emphasis?: "neutral" | "warning";
}) {
  const safe = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // Leave the bottom quarter open so the arc reads as a gauge, not a donut.
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
          // Rotate so the arc starts bottom-left and sweeps clockwise.
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
          {/* Omitted entirely at zero: a zero-length dash with a round cap
              still paints a dot in some browsers, which would read as a sliver
              of occupancy that is not there — including while loading. */}
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
  /** Secondary figure shown beside the label, e.g. a count. */
  meta?: string;
};

const STEP_TOKENS = [
  "var(--chart-step-1)",
  "var(--chart-step-2)",
  "var(--chart-step-3)",
  "var(--chart-step-4)",
  "var(--chart-step-5)",
];

/**
 * A single horizontal bar split into ordered segments, with a legend.
 *
 * Used where the categories are stages of one lifecycle: colour runs light to
 * dark along the ramp so the reader sees the ordering in the colour itself,
 * which a categorical palette would throw away. Every segment is also named in
 * the legend, so identity never rests on colour alone.
 */
export function CompositionBar({
  segments,
  total,
  className,
}: {
  segments: CompositionSegment[];
  /** Preformatted total, shown above the bar. */
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
