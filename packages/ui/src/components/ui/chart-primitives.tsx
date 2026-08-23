"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
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
 * Columns rather than horizontal bars, and deliberately fat ones: the band is
 * almost entirely fill, so the silhouette itself carries the comparison before
 * anyone reads an axis. A crosshatch sits inside the fill so the marks survive
 * greyscale, forced-colours and colour-blind viewing without relying on hue.
 *
 * A brighter stroke traces the top of every column and runs on to meet the next
 * one, which turns a set of separate magnitudes into a readable trend without
 * adding a second axis or a second series.
 *
 * Values sit in a header band above the plot, aligned on one line rather than
 * floating at each column's own height — a row of numbers is easier to scan
 * when it is actually a row. The category names take the axis underneath.
 */

/**
 * Fraction of each category band left empty. Enough to clear the extrusion on
 * the column's right, and no more — the columns still have to read fat.
 */
const CATEGORY_GAP = 0.16;
/** Gap either side of a column, expressed against the column's own width. */
const GAP_RATIO = CATEGORY_GAP / (1 - CATEGORY_GAP);
/** How far a column steps back, against its own width. */
const DEPTH_RATIO = 0.14;
/** How far the back edge rises against the depth it steps back. */
const DEPTH_RISE = 0.55;
const MAX_DEPTH = 16;
/**
 * The lit faces are let through a little, so they read as planes catching light
 * rather than as flat cut-outs stuck to the side. The right face sits back from
 * the light, so it is the more translucent of the two — that difference is what
 * separates the two planes without a stroke between them.
 */
const TOP_FACE_OPACITY = 0.88;
const SIDE_FACE_OPACITY = 0.68;
const AXIS_WIDTH = 44;
const XAXIS_HEIGHT = 28;
/**
 * The hover wash. Pre-mixed rather than an opacity, because the same value has
 * to work as a CSS background behind live text — an `opacity` there would fade
 * the number along with the wash.
 */
const HOVER_FILL = "color-mix(in srgb, var(--chart-track) 45%, transparent)";
/**
 * The column hatch, as CSS rather than an SVG pattern, for marks drawn in plain
 * HTML. Same 7px lattice so the two forms read as one material.
 */
const HATCH_CSS =
  "repeating-linear-gradient(45deg, var(--chart-mark-hatch) 0 1px, transparent 1px 7px), " +
  "repeating-linear-gradient(-45deg, var(--chart-mark-hatch) 0 1px, transparent 1px 7px)";
/** Room for the last column's extrusion, matched by the header band. */
const RIGHT_INSET = MAX_DEPTH + 2;
const HEADER_HEIGHT = 30;
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

type ColumnProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  series: CategoryDatum[];
};

/**
 * One column, drawn as a standing cuboid.
 *
 * The front face is the dark, textured plane that carries the reading. Its top
 * and right edges step back to a lit top face and right face, both flat accent,
 * so the depth comes from the silhouette rather than from a gradient or a
 * shadow. Nothing is drawn between columns: each magnitude is its own solid.
 *
 * The extrusion is clamped to the gap between bands, because a side face wide
 * enough to reach the next column would read as part of it.
 */
function Column({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  index = 0,
  series,
}: ColumnProps) {
  const datum = series[index];
  if (!datum || width <= 0 || height <= 0) return null;

  const baseline = y + height;
  const gap = width * GAP_RATIO;
  const depth = Math.min(width * DEPTH_RATIO, gap * 0.85, MAX_DEPTH);
  const rise = Math.min(depth * DEPTH_RISE, height);

  const right = x + width;
  const back = right + depth;
  const backTop = y - rise;

  return (
    <g>
      <path
        d={`M${x},${y} L${x + depth},${backTop} L${back},${backTop} L${right},${y} Z`}
        fill="var(--chart-accent)"
        fillOpacity={TOP_FACE_OPACITY}
      />
      <path
        d={`M${right},${y} L${back},${backTop} L${back},${baseline} L${right},${baseline} Z`}
        fill="var(--chart-accent)"
        fillOpacity={SIDE_FACE_OPACITY}
      />
      <path
        d={`M${x},${y} L${right},${y} L${right},${baseline} L${x},${baseline} Z`}
        fill={`url(#${HATCH_ID})`}
      />
    </g>
  );
}

/** Axis ticks read as 12k / 1.4M rather than a wall of digits. */
function compactTick(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000)
    return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(value);
}

/**
 * Resolves the hovered category to an index into the data.
 *
 * Recharts reports it as its `TooltipIndex`, which is a *string* — comparing it
 * with `typeof === "number"` silently never matches, and the hover state just
 * never turns on. Coerce, then bounds-check against the data actually rendered.
 */
function activeBandIndex(value: unknown, length: number): number | null {
  if (value == null || value === "") return null;
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < length ? index : null;
}

export function CategoryBarChart({
  data,
  className,
  height,
  minHeight = 148,
  valueLabel = "Value",
}: {
  data: CategoryDatum[];
  className?: string;
  /**
   * Fixed pixel height for the whole figure, header band included. Omit it and
   * the figure fills its parent instead, which is what a panel wants when a
   * sibling panel sets the row height.
   */
  height?: number;
  /** Floor for the fill case, so few categories still read as a chart. */
  minHeight?: number;
  valueLabel?: string;
}) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const bands = Math.max(1, data.length);

  return (
    <div
      className={cn(
        "relative flex w-full flex-col",
        height == null && "h-full min-h-0",
        className
      )}
      style={height == null ? { minHeight } : { height }}
      onMouseLeave={() => setActiveIndex(null)}
    >
      {/* One highlight for the hovered category, drawn behind both the number
          and its column so the two read as a single band. Recharts' own cursor
          is switched off below: it can only paint inside the plot, which would
          stop the wash short of the header. */}
      {activeIndex != null ? (
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 rounded-sm"
          style={{
            bottom: XAXIS_HEIGHT,
            left: `calc(${AXIS_WIDTH}px + (100% - ${AXIS_WIDTH + RIGHT_INSET}px) * ${activeIndex} / ${bands})`,
            width: `calc((100% - ${AXIS_WIDTH + RIGHT_INSET}px) / ${bands})`,
            backgroundColor: HOVER_FILL,
          }}
        />
      ) : null}

      {/* Aligned with the plot by reserving exactly the axis width, so each
          number sits over its own column. */}
      <div
        className="relative flex shrink-0"
        style={{
          paddingLeft: AXIS_WIDTH,
          paddingRight: RIGHT_INSET,
          height: HEADER_HEIGHT,
        }}
      >
        {data.map(datum => (
          <div
            key={datum.name}
            className="flex min-w-0 flex-1 items-center justify-center px-1.5"
          >
            <span className="truncate text-[13px] font-semibold tabular-nums text-foreground">
              {datum.display}
            </span>
          </div>
        ))}
      </div>

      <div className="relative min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={data}
            margin={{ top: 6, right: RIGHT_INSET, left: 0, bottom: 0 }}
            barCategoryGap={`${CATEGORY_GAP * 100}%`}
            onMouseMove={state =>
              setActiveIndex(
                activeBandIndex(state?.activeTooltipIndex, data.length)
              )
            }
            onMouseLeave={() => setActiveIndex(null)}
          >
            <ColumnHatch />
            <XAxis
              dataKey="name"
              interval={0}
              axisLine={false}
              tickLine={false}
              tick={AXIS_TICK}
              height={XAXIS_HEIGHT}
            />
            <YAxis
              width={AXIS_WIDTH}
              axisLine={false}
              tickLine={false}
              tick={AXIS_TICK}
              tickFormatter={compactTick}
            />
            <Tooltip
              cursor={false}
              content={<CategoryTooltip valueLabel={valueLabel} />}
            />
            <Bar
              dataKey="value"
              isAnimationActive={false}
              shape={props => <Column {...props} series={data} />}
            />
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
 * Same hue, hatch and lit leading edge as the columns — a different form for a
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
