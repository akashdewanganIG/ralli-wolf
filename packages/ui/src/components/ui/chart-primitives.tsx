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
 * Thick vertical columns for comparing magnitude across named categories.
 *
 * Horizontal bars rather than columns, because the axis that grows is the one
 * that can afford to. A new movement type adds a row; columns would have had
 * to share the same width between more and more of them until each was a
 * sliver. Rows also give category names a full line to sit on instead of a
 * cramped tick under a column.
 *
 * The bars are deliberately slim. A fat column carried the comparison by
 * silhouette when there were six of them across a wide panel; in a stack of
 * rows the length alone does that, and thickness only costs vertical space
 * that more categories will want.
 *
 * A crosshatch sits inside the fill so the marks survive greyscale,
 * forced-colours and colour-blind viewing without relying on hue, and a
 * brighter cap closes the measuring end of each bar.
 *
 * Values sit at the end of their own bar, which is where the eye already is
 * after reading its length.
 */

/**
 * The hover wash. Pre-mixed rather than an opacity so it can also be used as a
 * plain CSS background without fading text drawn over it.
 */
const HOVER_FILL = "color-mix(in srgb, var(--chart-track) 45%, transparent)";
/** Width reserved for category names. Enough for "Production consumption". */
const NAME_WIDTH = 148;
/** Height of one category row, and the thickness of the bar inside it. */
const ROW_HEIGHT = 32;
const BAR_SIZE = 13;
/**
 * The numeric scale is kept but not drawn. Every bar already carries its own
 * value at the end, so a row of ticks underneath repeats what is written and
 * costs a strip of height that the rows themselves can use — and when the
 * plot scrolls, a bottom axis is the first thing to fall out of view.
 */
const XAXIS_HEIGHT = 0;
/** Room at the right for the value that sits past the end of the longest bar. */
const VALUE_INSET = 64;
/**
 * Beyond this many rows the plot scrolls instead of growing without bound, so
 * a panel cannot be pushed off the page by a long tail of categories.
 */
const MAX_VISIBLE_ROWS = 10;
/**
 * The same hatch as CSS rather than an SVG pattern, for marks drawn in plain
 * HTML. Same 7px lattice so the two forms read as one material.
 */
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

/**
 * One bar, drawn flat and measuring left to right.
 *
 * The crosshatch carries the mark without relying on hue, and a 2px cap closes
 * the measuring end — the right edge here, where a column had it on top.
 */
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
  /** Rows shown before the plot starts scrolling instead of growing. */
  maxVisibleRows?: number;
}) {
  const rows = data.length;
  // The plot is sized by its content, not by a figure given a fixed height:
  // every category gets the same row, however many there are. Past the cap the
  // wrapper scrolls, so a long tail of categories never squashes the rows nor
  // pushes the rest of the panel off the page.
  const plotHeight = rows * ROW_HEIGHT + XAXIS_HEIGHT;
  const visibleHeight =
    Math.min(rows, maxVisibleRows) * ROW_HEIGHT + XAXIS_HEIGHT;

  return (
    <div
      className={cn(
        "w-full overflow-y-auto overscroll-y-contain",
        // The numeric axis is pinned to the bottom of the plot, so when the
        // rows scroll it travels with them rather than floating unlabelled.
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
            {/* Recharts paints its own band here, which is exactly the shape we
                want now that the values sit inside the plot rather than in a
                header band above it. */}
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
  /** Category name. Words, so it gets its own line rather than an axis tick. */
  label: string;
  /** Magnitude that sets bar length. */
  value: number;
  /** Preformatted value, shown beside the label. */
  display: string;
  /** Secondary reading — a share, a count — set muted after the label. */
  meta?: string;
};

/**
 * Ranked horizontal bars for magnitude across a handful of named categories.
 *
 * A stacked composition bar answers "what share of the whole" in one line, but
 * it turns every small category into an unreadable sliver and strands its name
 * in a legend. One row per category keeps the small ones legible and puts each
 * number next to its own bar, which is the reading this panel actually needs.
 *
 * Bars scale to the largest value rather than the total, so the comparison uses
 * the full width; the share each category holds is stated in `meta` instead of
 * being left for the reader to estimate from a length.
 *
 * Same hue, hatch and lit end cap as the columns — a different form for a
 * different job, not a different chart language.
 */
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
            {/* A floor on the width so a category that rounds to nothing still
                leaves a mark instead of vanishing from the list. */}
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
