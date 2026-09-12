"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import { Loader2, Maximize2, Minus, Plus, RefreshCw } from "@repo/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import type { FlowStep, UserFlow } from "@/lib/architecture-map";
import {
  computeFlowLayout,
  orthogonalPath,
  type FlowLayout,
} from "@/lib/architecture-layout";

const PAD = 24;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 1.8;
const EMPTY: FlowLayout = { nodes: [], edges: [], width: 0, height: 0 };

/** Shape language, since the palette is neutral and hue is not available. */
const KIND_TAG: Record<FlowStep["kind"], string> = {
  start: "start",
  end: "done",
  action: "",
  auto: "auto",
  decision: "",
};

export function FlowChart({ flow }: { flow: UserFlow }) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = React.useState<FlowLayout>(EMPTY);
  const [isComputing, setComputing] = React.useState(true);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: PAD, y: PAD });
  // The decision outline is SVG and its text is HTML, so a CSS hover cannot
  // reach across the two. Track it here and style both from one place.
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setComputing(true);
    computeFlowLayout(flow.steps)
      .then(next => {
        if (!cancelled) setLayout(next);
      })
      .finally(() => {
        if (!cancelled) setComputing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [flow.steps]);

  const stepById = React.useMemo(
    () => new Map(flow.steps.map(step => [step.id, step])),
    [flow.steps]
  );

  const clampZoom = (value: number) =>
    Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

  const fitToScreen = React.useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !layout.width || !layout.height) return;
    const { clientWidth, clientHeight } = viewport;
    if (!clientWidth || !clientHeight) return;
    const next = clampZoom(
      Math.min(
        (clientWidth - PAD * 2) / layout.width,
        (clientHeight - PAD * 2) / layout.height
      )
    );
    setZoom(next);
    setPan({
      x: (clientWidth - layout.width * next) / 2,
      y: Math.max(PAD, (clientHeight - layout.height * next) / 2),
    });
  }, [layout.width, layout.height]);

  // Re-frame whenever a different flow is drawn.
  const lastFitted = React.useRef("");
  React.useEffect(() => {
    if (isComputing || !layout.width) return;
    const signature = `${flow.id}:${layout.width}x${layout.height}`;
    if (lastFitted.current === signature) return;
    lastFitted.current = signature;
    fitToScreen();
  }, [isComputing, layout.width, layout.height, flow.id, fitToScreen]);

  const zoomBy = (factor: number) => {
    const viewport = viewportRef.current;
    setZoom(current => {
      const next = clampZoom(current * factor);
      if (viewport) {
        const cx = viewport.clientWidth / 2;
        const cy = viewport.clientHeight / 2;
        setPan(p => ({
          x: cx - ((cx - p.x) / current) * next,
          y: cy - ((cy - p.y) / current) * next,
        }));
      }
      return next;
    });
  };

  const drag = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-flow-node]")) return;
    if (event.button !== 0) return;
    viewportRef.current?.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    setPan({
      x: state.originX + (event.clientX - state.startX),
      y: state.originY + (event.clientY - state.startY),
    });
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    viewportRef.current?.releasePointerCapture(event.pointerId);
    drag.current = null;
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1.08 : 1 / 1.08);
      return;
    }
    setPan(current => ({
      x: current.x - event.deltaX,
      y: current.y - event.deltaY,
    }));
  };

  return (
    <div className="relative flex-1 overflow-hidden rounded-lg border border-border bg-surface-subtle">
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
        className="h-full w-full cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--color-border) 1px, transparent 1px)",
          backgroundSize: `${26 * zoom}px ${26 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        <div
          className={cn(
            "relative origin-top-left transition-opacity duration-150",
            isComputing && "opacity-50"
          )}
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <svg
            className="pointer-events-none absolute inset-0 overflow-visible"
            width={layout.width || 1}
            height={layout.height || 1}
            aria-hidden="true"
          >
            <defs>
              <marker
                id="flow-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="9"
                markerHeight="9"
                orient="auto-start-reverse"
                markerUnits="userSpaceOnUse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" className="fill-foreground/75" />
              </marker>
            </defs>

            {/* Decision outlines live in the SVG layer so they can be real
                bordered hexagons; a CSS clip-path would drop the border. */}
            {layout.nodes.map(box => {
              const step = stepById.get(box.id);
              if (step?.kind !== "decision") return null;
              const notch = 14;
              const { x, y, w, h } = box;
              return (
                <path
                  key={`shape-${box.id}`}
                  d={`M ${x + notch} ${y} L ${x + w - notch} ${y} L ${x + w} ${y + h / 2} L ${x + w - notch} ${y + h} L ${x + notch} ${y + h} L ${x} ${y + h / 2} Z`}
                  className={cn(
                    "transition-[stroke,fill] duration-150",
                    hoveredId === box.id
                      ? "fill-surface-elevated stroke-foreground"
                      : "fill-surface stroke-border-strong"
                  )}
                  strokeWidth={hoveredId === box.id ? 1.6 : 1.25}
                />
              );
            })}

            {layout.edges.map(edge => (
              <g key={edge.id}>
                <path
                  d={orthogonalPath(edge.points, 10)}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="stroke-foreground/60"
                  strokeWidth={1.4}
                  markerEnd="url(#flow-arrow)"
                />
                {edge.labelBox && edge.label ? (
                  <>
                    <rect
                      x={edge.labelBox.x}
                      y={edge.labelBox.y}
                      width={edge.labelBox.w}
                      height={edge.labelBox.h}
                      rx={7}
                      className="fill-surface stroke-border"
                      strokeWidth={0.75}
                    />
                    <text
                      x={edge.labelBox.x + edge.labelBox.w / 2}
                      y={edge.labelBox.y + edge.labelBox.h / 2 + 3.2}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[9px] font-medium"
                    >
                      {edge.label}
                    </text>
                  </>
                ) : null}
              </g>
            ))}
          </svg>

          {layout.nodes.map(box => {
            const step = stepById.get(box.id);
            if (!step) return null;
            return (
              <FlowNode
                key={box.id}
                step={step}
                box={box}
                onHoverChange={hovered =>
                  setHoveredId(current =>
                    hovered ? box.id : current === box.id ? null : current
                  )
                }
              />
            );
          })}
        </div>
      </div>

      {isComputing ? (
        <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-surface/95 px-2.5 py-1 text-[0.6875rem] text-muted-foreground shadow-sm backdrop-blur">
          <Loader2 className="size-3 animate-spin" />
          Arranging
        </div>
      ) : null}

      <div className="absolute right-3 top-3 flex flex-col items-center gap-0.5 rounded-lg border border-border bg-surface/95 p-1 shadow-sm backdrop-blur">
        <FlowControl label="Zoom in" onClick={() => zoomBy(1.2)}>
          <Plus className="size-3.5" />
        </FlowControl>
        <span className="px-1 text-[0.625rem] tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <FlowControl label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
          <Minus className="size-3.5" />
        </FlowControl>
        <div className="my-0.5 h-px w-5 bg-border" />
        <FlowControl label="Fit to screen" onClick={fitToScreen}>
          <Maximize2 className="size-3.5" />
        </FlowControl>
        <FlowControl
          label="Reset view"
          onClick={() => {
            setZoom(1);
            setPan({ x: PAD, y: PAD });
          }}
        >
          <RefreshCw className="size-3.5" />
        </FlowControl>
      </div>

      <FlowLegend />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FlowNode({
  step,
  box,
  onHoverChange,
}: {
  step: FlowStep;
  box: { x: number; y: number; w: number; h: number };
  onHoverChange: (hovered: boolean) => void;
}) {
  const isTerminal = step.kind === "start" || step.kind === "end";
  const isDecision = step.kind === "decision";
  const tag = KIND_TAG[step.kind];

  const shell = cn(
    "flex h-full w-full flex-col justify-center gap-0.5 px-3 text-left outline-none",
    "transition-[background-color,border-color,box-shadow,transform] duration-150",
    "focus-visible:ring-2 focus-visible:ring-ring/50",
    isDecision
      ? // The hexagon behind it is drawn in SVG; this layer is text only.
        "items-center border-0 bg-transparent px-7 text-center"
      : isTerminal
        ? "rounded-full border border-border-strong bg-muted px-5"
        : step.kind === "auto"
          ? "rounded-md border border-dashed border-border bg-surface-subtle"
          : "rounded-md border border-border bg-surface",
    step.route && "cursor-pointer",
    step.route &&
      !isDecision &&
      "hover:-translate-y-px hover:border-border-strong hover:shadow-sm",
    step.route && !isDecision && !isTerminal && "hover:bg-surface-elevated"
  );

  const body = (
    <>
      {tag ? (
        <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {tag}
        </span>
      ) : null}
      <span
        className={cn(
          "line-clamp-2 text-[0.78125rem] leading-4 text-foreground",
          isDecision ? "font-semibold" : "font-medium"
        )}
      >
        {step.label}
      </span>
      {step.note && !isDecision ? (
        <span className="line-clamp-1 text-[0.625rem] leading-3 text-muted-foreground">
          {step.note}
        </span>
      ) : null}
    </>
  );

  const content = step.route ? (
    <Link href={step.route} className={shell}>
      {body}
    </Link>
  ) : (
    <div className={shell} tabIndex={0} role="group" aria-label={step.label}>
      {body}
    </div>
  );

  return (
    <div
      data-flow-node
      className="absolute"
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onFocusCapture={() => onHoverChange(true)}
      onBlurCapture={() => onHoverChange(false)}
    >
      <TooltipProvider delayDuration={250}>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="max-w-[18rem]">
            <span className="block text-[0.625rem] uppercase tracking-wide opacity-75">
              {step.kind === "decision"
                ? "Decision"
                : step.kind === "auto"
                  ? "The system does this on its own"
                  : step.kind === "action"
                    ? "Someone does this"
                    : step.kind === "start"
                      ? "Starting point"
                      : "End of the flow"}
            </span>
            <span className="block font-medium">{step.label}</span>
            {step.note ? (
              <span className="mt-0.5 block opacity-90">{step.note}</span>
            ) : null}
            {step.route ? (
              <span className="mt-0.5 block opacity-75">
                Opens {step.route}
              </span>
            ) : null}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function FlowControl({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function FlowLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 hidden max-w-[calc(100%-1.5rem)] select-none flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface/95 px-2.5 py-1.5 text-[0.6875rem] text-muted-foreground shadow-sm backdrop-blur sm:flex">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-6 rounded-full border border-border-strong bg-muted" />
        Start / end
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-6 rounded-[3px] border border-border bg-surface" />
        Someone does this
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-6 rounded-[3px] border border-dashed border-border bg-surface-subtle" />
        Automatic
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="26" height="12" aria-hidden="true" className="shrink-0">
          <path
            d="M 5 1 L 21 1 L 25 6 L 21 11 L 5 11 L 1 6 Z"
            className="fill-surface stroke-border-strong"
            strokeWidth="1"
          />
        </svg>
        Decision
      </span>
    </div>
  );
}
