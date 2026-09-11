"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import {
  ExternalLink,
  Link2,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  X,
} from "@repo/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import {
  ARCH_NODE_BY_ID,
  type ArchNode,
  type ArchRelation,
} from "@/lib/architecture-map";
import { orthogonalPath, type LayoutEdge } from "@/lib/architecture-layout";
import { useGraphLayout } from "./use-graph-layout";

const PAD = 28;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;

export interface ArchitectureViewProps {
  modules: ArchNode[];
  /** Already filtered for the signed-in user's access. */
  nodesByParent: Map<string | null, ArchNode[]>;
  relations: ArchRelation[];
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  focusRequest: { id: string; nonce: number } | null;
  showAllConnections: boolean;
}

/** The section a leaf sits in, if any — the sidebar's sub-menu level. */
function sectionOf(nodeId: string): ArchNode | null {
  const parent = ARCH_NODE_BY_ID.get(nodeId)?.parent;
  if (!parent) return null;
  const node = ARCH_NODE_BY_ID.get(parent);
  return node?.kind === "section" ? node : null;
}

/** Walks up the parent chain to the owning module. */
function moduleOf(nodeId: string): ArchNode | null {
  let current = ARCH_NODE_BY_ID.get(nodeId);
  while (current?.parent) {
    const parent = ARCH_NODE_BY_ID.get(current.parent);
    if (!parent) break;
    if (parent.kind === "module") return parent;
    current = parent;
  }
  return null;
}

export function ArchitectureView({
  modules,
  nodesByParent,
  relations,
  collapsed,
  onToggleCollapse,
  focusRequest,
  showAllConnections,
}: ArchitectureViewProps) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: PAD, y: PAD });
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [highlightId, setHighlightId] = React.useState<string | null>(null);
  const [isolatedId, setIsolatedId] = React.useState<string | null>(null);

  /* ---------------- which nodes are on the canvas ---------------- */

  const allLeaves = React.useMemo(() => {
    const leaves: ArchNode[] = [];
    const walk = (parentId: string) => {
      for (const child of nodesByParent.get(parentId) ?? []) {
        if (child.kind === "section") walk(child.id);
        else leaves.push(child);
      }
    };
    for (const owner of modules) walk(owner.id);
    return leaves;
  }, [modules, nodesByParent]);

  const visibleLeaves = React.useMemo(
    () =>
      allLeaves.filter(leaf => {
        const owner = moduleOf(leaf.id);
        if (owner && collapsed.has(owner.id)) return false;
        if (leaf.parent && collapsed.has(leaf.parent)) return false;
        return true;
      }),
    [allLeaves, collapsed]
  );

  const isolated = React.useMemo(() => {
    if (!isolatedId) return null;
    const centre = ARCH_NODE_BY_ID.get(isolatedId);
    if (!centre) return null;
    const keep = new Set<string>([isolatedId]);
    for (const relation of relations) {
      if (relation.from === isolatedId) keep.add(relation.to);
      if (relation.to === isolatedId) keep.add(relation.from);
    }
    const nodes = [...keep]
      .map(id => ARCH_NODE_BY_ID.get(id))
      .filter((node): node is ArchNode => Boolean(node));
    return { centre, nodes, count: keep.size - 1 };
  }, [isolatedId, relations]);

  /**
   * Edge labels need room, and reserving it grows the canvas about 2.4x. Worth
   * it when a handful of edges are on screen, unreadable on the full map — so
   * labels ride along only in the isolated view.
   */
  const layoutInput = React.useMemo(
    () => ({
      nodes: isolated ? isolated.nodes : visibleLeaves,
      relations,
      withLabels: Boolean(isolated),
    }),
    [isolated, visibleLeaves, relations]
  );

  const { layout, isComputing, error } = useGraphLayout(layoutInput);

  const boxes = React.useMemo(
    () => new Map(layout.nodes.map(node => [node.id, node])),
    [layout.nodes]
  );

  const nodeById = React.useMemo(() => {
    const map = new Map<string, ArchNode>();
    for (const node of isolated ? isolated.nodes : visibleLeaves)
      map.set(node.id, node);
    return map;
  }, [isolated, visibleLeaves]);

  /* ---------------- which edges are drawn ---------------- */

  const edges = React.useMemo(() => {
    if (isolated) return layout.edges;
    if (showAllConnections) return layout.edges;
    // At rest only the cross-module story plus whatever the pointer is on, so
    // the resting canvas stays legible.
    return layout.edges.filter(edge => {
      const touchesActive =
        activeId !== null &&
        (edge.relation.from === activeId || edge.relation.to === activeId);
      if (touchesActive) return true;
      if (edge.relation.kind === "handoff") return true;
      return (
        moduleOf(edge.relation.from)?.id !== moduleOf(edge.relation.to)?.id
      );
    });
  }, [isolated, layout.edges, showAllConnections, activeId]);

  const connectionCount = React.useCallback(
    (nodeId: string) =>
      relations.reduce(
        (total, relation) =>
          relation.from === nodeId || relation.to === nodeId
            ? total + 1
            : total,
        0
      ),
    [relations]
  );

  /* ---------------- zoom + pan ---------------- */

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
      y: (clientHeight - layout.height * next) / 2,
    });
  }, [layout.width, layout.height]);

  const reset = React.useCallback(() => {
    setZoom(1);
    setPan({ x: PAD, y: PAD });
  }, []);

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

  // Re-frame whenever the drawing is replaced wholesale.
  const lastFitted = React.useRef("");
  React.useEffect(() => {
    if (isComputing || !layout.width) return;
    const signature = `${layout.width}x${layout.height}`;
    if (lastFitted.current === signature) return;
    lastFitted.current = signature;
    fitToScreen();
  }, [isComputing, layout.width, layout.height, fitToScreen]);

  const dragState = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-arch-node]")) return;
    if (event.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.setPointerCapture(event.pointerId);
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    });
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    viewportRef.current?.releasePointerCapture(event.pointerId);
    dragState.current = null;
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

  /* ---------------- reveal + focus ---------------- */

  const revealForKeyboard = React.useCallback(
    (nodeId: string) => {
      const box = boxes.get(nodeId);
      const viewport = viewportRef.current;
      if (!box || !viewport) return;
      const left = box.x * zoom + pan.x;
      const top = box.y * zoom + pan.y;
      const right = left + box.w * zoom;
      const bottom = top + box.h * zoom;
      const margin = 28;
      let dx = 0;
      let dy = 0;
      if (left < margin) dx = margin - left;
      else if (right > viewport.clientWidth - margin)
        dx = viewport.clientWidth - margin - right;
      if (top < margin) dy = margin - top;
      else if (bottom > viewport.clientHeight - margin)
        dy = viewport.clientHeight - margin - bottom;
      if (dx || dy)
        setPan(current => ({ x: current.x + dx, y: current.y + dy }));
    },
    [boxes, zoom, pan.x, pan.y]
  );

  React.useEffect(() => {
    if (!focusRequest) return;
    setIsolatedId(null);
    setActiveId(focusRequest.id);
    setHighlightId(focusRequest.id);
    const timer = window.setTimeout(() => setHighlightId(null), 2400);
    return () => window.clearTimeout(timer);
  }, [focusRequest]);

  // Centring has to wait for the layout that contains the node.
  React.useEffect(() => {
    if (!focusRequest || isComputing) return;
    const box = boxes.get(focusRequest.id);
    const viewport = viewportRef.current;
    if (!box || !viewport) return;
    setPan({
      x: viewport.clientWidth / 2 - (box.x + box.w / 2) * zoom,
      y: viewport.clientHeight / 2 - (box.y + box.h / 2) * zoom,
    });
    // Only when a new request arrives, or the layout it targets finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest, isComputing]);

  React.useEffect(() => {
    if (!isolatedId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsolatedId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isolatedId]);

  /* ---------------- render ---------------- */

  return (
    <div className="relative flex-1 overflow-hidden rounded-lg border border-border bg-surface-subtle">
      <svg className="pointer-events-none absolute size-0" aria-hidden="true">
        <EdgeMarkers />
      </svg>

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
            isComputing && "opacity-60"
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
            {edges.map(edge => (
              <EdgePath
                key={edge.id}
                edge={edge}
                emphasised={
                  Boolean(isolated) ||
                  edge.relation.from === activeId ||
                  edge.relation.to === activeId
                }
                showLabel={Boolean(isolated)}
              />
            ))}
          </svg>

          {layout.nodes.map(box => {
            const node = nodeById.get(box.id);
            if (!node) return null;
            return (
              <ArchNodeCard
                key={box.id}
                node={node}
                box={box}
                isActive={activeId === box.id}
                isHighlighted={highlightId === box.id}
                isCentre={isolated?.centre.id === box.id}
                connectionCount={connectionCount(box.id)}
                onActivate={setActiveId}
                onKeyboardFocus={revealForKeyboard}
                onIsolate={setIsolatedId}
              />
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="absolute inset-x-3 top-3 rounded-md border border-border bg-surface px-3 py-2 text-[0.75rem] text-muted-foreground shadow-sm">
          The diagram could not be laid out: {error}
        </div>
      ) : null}

      {isComputing ? (
        <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-surface/95 px-2.5 py-1 text-[0.6875rem] text-muted-foreground shadow-sm backdrop-blur">
          <Loader2 className="size-3 animate-spin" />
          Arranging
        </div>
      ) : null}

      {isolated ? (
        <div className="absolute left-3 top-3 flex max-w-[calc(100%-5rem)] items-center gap-2 rounded-lg border border-border bg-surface/95 py-1.5 pl-2.5 pr-1.5 shadow-sm backdrop-blur">
          <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate text-[0.75rem] text-muted-foreground">
            Connections for{" "}
            <span className="font-semibold text-foreground">
              {isolated.centre.label}
            </span>{" "}
            · {isolated.count} {isolated.count === 1 ? "node" : "nodes"}
          </span>
          <button
            type="button"
            onClick={() => setIsolatedId(null)}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground outline-none transition-colors hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
            aria-label="Show the full map again"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <ModuleFilter
          modules={modules}
          nodesByParent={nodesByParent}
          collapsed={collapsed}
          onToggle={onToggleCollapse}
        />
      )}

      <DiagramControls
        onZoomIn={() => zoomBy(1.2)}
        onZoomOut={() => zoomBy(1 / 1.2)}
        onFit={fitToScreen}
        onReset={reset}
        zoom={zoom}
      />

      <Legend isolated={Boolean(isolated)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Edges                                                               */
/* ------------------------------------------------------------------ */

/**
 * The palette is strictly neutral, so relation kinds are told apart by weight,
 * dash and arrowhead rather than by colour.
 */
const EDGE_STYLE: Record<
  ArchRelation["kind"],
  { width: number; dash?: string; marker: string; opacity: number }
> = {
  handoff: { width: 2, marker: "arrow-handoff", opacity: 1 },
  feeds: { width: 1.25, marker: "arrow-feeds", opacity: 0.85 },
  shared: { width: 1, dash: "1 4", marker: "arrow-shared", opacity: 0.7 },
  auto: { width: 1.25, dash: "5 4", marker: "arrow-auto", opacity: 0.8 },
};

function EdgeMarkers() {
  const head = (
    id: string,
    className: string,
    scale: number,
    open: boolean
  ) => (
    <marker
      key={id}
      id={id}
      viewBox="0 0 10 10"
      refX={open ? 8 : 9}
      refY="5"
      markerWidth={6 * scale}
      markerHeight={6 * scale}
      orient="auto-start-reverse"
      markerUnits="userSpaceOnUse"
    >
      {open ? (
        <path
          d="M 1 1 L 9 5 L 1 9"
          fill="none"
          strokeWidth="1.6"
          className={className.replace("fill-", "stroke-")}
        />
      ) : (
        <path d="M 0 1 L 10 5 L 0 9 z" className={className} />
      )}
    </marker>
  );

  return (
    <defs>
      {head("arrow-handoff", "fill-foreground", 1.7, false)}
      {head("arrow-feeds", "fill-foreground/70", 1.4, false)}
      {head("arrow-shared", "fill-muted-foreground", 1.3, true)}
      {head("arrow-auto", "fill-muted-foreground", 1.3, true)}
      {head("arrow-active", "fill-foreground", 1.7, false)}
    </defs>
  );
}

function EdgePath({
  edge,
  emphasised,
  showLabel,
}: {
  edge: LayoutEdge;
  emphasised: boolean;
  showLabel: boolean;
}) {
  const style = EDGE_STYLE[edge.relation.kind];
  const d = orthogonalPath(edge.points);
  const start = edge.points[0];

  return (
    <g>
      <path
        d={d}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          "transition-[stroke,stroke-width] duration-150",
          emphasised
            ? "stroke-foreground"
            : edge.relation.kind === "handoff"
              ? "stroke-foreground/70"
              : "stroke-border-strong"
        )}
        strokeWidth={emphasised ? style.width + 0.5 : style.width}
        strokeDasharray={style.dash}
        opacity={emphasised ? 1 : style.opacity}
        markerEnd={`url(#${emphasised ? "arrow-active" : style.marker})`}
      />
      {/* A tail dot marks where the relation originates, so direction reads
          even where an edge runs behind a denser part of the diagram. */}
      {start ? (
        <circle
          cx={start.x}
          cy={start.y}
          r={emphasised ? 2.75 : 2}
          className={cn(
            emphasised ? "fill-foreground" : "fill-border-strong",
            "transition-all duration-150"
          )}
        />
      ) : null}
      {showLabel && edge.label ? (
        <>
          <rect
            x={edge.label.x}
            y={edge.label.y}
            width={edge.label.w}
            height={edge.label.h}
            rx={4}
            className="fill-surface stroke-border"
            strokeWidth={0.75}
          />
          <text
            x={edge.label.x + edge.label.w / 2}
            y={edge.label.y + edge.label.h / 2 + 3.2}
            textAnchor="middle"
            className="fill-muted-foreground text-[9px]"
          >
            {edge.relation.label.length > 34
              ? `${edge.relation.label.slice(0, 33)}…`
              : edge.relation.label}
          </text>
        </>
      ) : null}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Nodes                                                               */
/* ------------------------------------------------------------------ */

function ArchNodeCard({
  node,
  box,
  isActive,
  isHighlighted,
  isCentre,
  connectionCount,
  onActivate,
  onKeyboardFocus,
  onIsolate,
}: {
  node: ArchNode;
  box: { x: number; y: number; w: number; h: number };
  isActive: boolean;
  isHighlighted: boolean;
  isCentre: boolean;
  connectionCount: number;
  onActivate: (id: string) => void;
  onKeyboardFocus: (id: string) => void;
  onIsolate: (id: string) => void;
}) {
  const owner = moduleOf(node.id);
  const section = sectionOf(node.id);
  // The flat layout has no container boxes, so the node itself has to carry
  // where it lives. The section is the finer, more useful locator; the full
  // path goes in the tooltip.
  const group = section ?? owner;
  const path = [owner?.label, section?.label].filter(Boolean).join(" › ");

  const tone = isCentre
    ? "border-border-strong bg-surface-elevated shadow-sm"
    : node.kind === "page"
      ? "border-border bg-surface hover:-translate-y-px hover:border-border-strong hover:bg-surface-elevated hover:shadow-sm"
      : node.kind === "external"
        ? "border-dashed border-border bg-surface-subtle hover:bg-hover"
        : "border-dashed border-border bg-transparent";

  const cardClass = cn(
    "flex h-full w-full flex-col justify-center gap-0.5 rounded-md border py-1 pl-2.5 pr-7 text-left outline-none",
    "transition-[background-color,border-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-ring/50",
    tone,
    isActive && !isCentre && "border-border-strong bg-surface-elevated",
    isHighlighted &&
      "ring-2 ring-ring ring-offset-2 ring-offset-surface-subtle",
    node.route ? "cursor-pointer" : "cursor-default"
  );

  const body = (
    <>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 truncate text-[0.78125rem] font-medium leading-4 text-foreground">
          {node.label}
        </span>
        {node.external ? (
          <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
        ) : null}
      </span>
      <span className="flex min-w-0 items-center gap-1 text-[0.625rem] leading-3 text-muted-foreground">
        {group ? (
          <span className="shrink-0 truncate font-semibold uppercase tracking-wide">
            {group.label}
          </span>
        ) : null}
        {group ? <span aria-hidden="true">·</span> : null}
        <span className="min-w-0 truncate">
          {node.kind === "concept" ? "no page" : (node.route ?? "")}
        </span>
      </span>
    </>
  );

  const handlers = {
    onFocus: () => {
      onActivate(node.id);
      onKeyboardFocus(node.id);
    },
    onMouseEnter: () => onActivate(node.id),
  };

  return (
    <div
      data-arch-node
      className="group absolute"
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
    >
      <TooltipProvider delayDuration={250}>
        <Tooltip>
          <TooltipTrigger asChild>
            {node.route && node.external ? (
              <a
                href={node.route}
                target="_blank"
                rel="noreferrer"
                className={cardClass}
                {...handlers}
              >
                {body}
              </a>
            ) : node.route ? (
              <Link href={node.route} className={cardClass} {...handlers}>
                {body}
              </Link>
            ) : (
              <div
                tabIndex={0}
                role="group"
                aria-label={node.label}
                className={cardClass}
                {...handlers}
              >
                {body}
              </div>
            )}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[19rem]">
            {path ? (
              <span className="block text-[0.625rem] uppercase tracking-wide opacity-75">
                {path}
              </span>
            ) : null}
            <span className="block font-medium">{node.label}</span>
            <span className="mt-0.5 block opacity-90">{node.description}</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {connectionCount > 0 && !isCentre ? (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={event => {
                  // The card navigates, so isolating needs its own target.
                  event.preventDefault();
                  event.stopPropagation();
                  onIsolate(node.id);
                }}
                aria-label={`Show only the connections for ${node.label}`}
                className="absolute right-1 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-hover hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40 group-focus-within:opacity-100 group-hover:opacity-100"
              >
                <Link2 className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Isolate · {connectionCount}{" "}
              {connectionCount === 1 ? "connection" : "connections"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chrome                                                              */
/* ------------------------------------------------------------------ */

/**
 * The graph is laid out flat, so modules cannot be collapsed by clicking a
 * container in the diagram. These chips take that job instead.
 */
function ModuleFilter({
  modules,
  nodesByParent,
  collapsed,
  onToggle,
}: {
  modules: ArchNode[];
  nodesByParent: Map<string | null, ArchNode[]>;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
}) {
  const sectionsOf = (moduleId: string) =>
    (nodesByParent.get(moduleId) ?? []).filter(
      child => child.kind === "section"
    );

  // The outline view collapses sections and shares this state, so a section
  // hidden on a phone would otherwise be unreachable once the canvas takes
  // over. Revealing a module clears its sections too.
  const reveal = (moduleId: string) => {
    onToggle(moduleId);
    for (const section of sectionsOf(moduleId)) {
      if (collapsed.has(section.id)) onToggle(section.id);
    }
  };

  const hiddenSections = modules.flatMap(entry =>
    sectionsOf(entry.id).filter(section => collapsed.has(section.id))
  );
  const anythingHidden =
    hiddenSections.length > 0 || modules.some(entry => collapsed.has(entry.id));

  return (
    <div className="absolute left-3 top-3 flex max-w-[calc(100%-5rem)] flex-wrap items-center gap-1 rounded-lg border border-border bg-surface/95 p-1 shadow-sm backdrop-blur">
      {modules.map(entry => {
        const hidden = collapsed.has(entry.id);
        const partly =
          !hidden &&
          sectionsOf(entry.id).some(section => collapsed.has(section.id));
        return (
          <button
            key={entry.id}
            type="button"
            title={partly ? "Some of this module is hidden" : undefined}
            onClick={() =>
              hidden || partly ? reveal(entry.id) : onToggle(entry.id)
            }
            aria-pressed={!hidden}
            className={cn(
              "rounded px-2 py-1 text-[0.6875rem] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
              hidden
                ? "text-muted-foreground/60 line-through hover:text-muted-foreground"
                : partly
                  ? "bg-muted text-muted-foreground"
                  : "bg-selected text-selected-foreground"
            )}
          >
            {entry.label}
            {partly ? <span aria-hidden="true"> ·</span> : null}
          </button>
        );
      })}
      {anythingHidden ? (
        <button
          type="button"
          onClick={() => {
            for (const entry of modules) {
              if (collapsed.has(entry.id)) onToggle(entry.id);
              for (const section of sectionsOf(entry.id)) {
                if (collapsed.has(section.id)) onToggle(section.id);
              }
            }
          }}
          className="rounded px-2 py-1 text-[0.6875rem] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          Show all
        </button>
      ) : null}
    </div>
  );
}

function ControlButton({
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

function DiagramControls({
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
  zoom,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  zoom: number;
}) {
  return (
    <div className="absolute right-3 top-3 flex flex-col items-center gap-0.5 rounded-lg border border-border bg-surface/95 p-1 shadow-sm backdrop-blur">
      <ControlButton label="Zoom in" onClick={onZoomIn}>
        <Plus className="size-3.5" />
      </ControlButton>
      <span className="px-1 text-[0.625rem] tabular-nums text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <ControlButton label="Zoom out" onClick={onZoomOut}>
        <Minus className="size-3.5" />
      </ControlButton>
      <div className="my-0.5 h-px w-5 bg-border" />
      <ControlButton label="Fit to screen" onClick={onFit}>
        <Maximize2 className="size-3.5" />
      </ControlButton>
      <ControlButton label="Reset view" onClick={onReset}>
        <RefreshCw className="size-3.5" />
      </ControlButton>
    </div>
  );
}

function LegendLine({
  width,
  dash,
  marker,
  className,
  children,
}: {
  width: number;
  dash?: string;
  marker: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="26" height="10" aria-hidden="true" className="shrink-0">
        <line
          x1="1"
          y1="5"
          x2="18"
          y2="5"
          className={className}
          strokeWidth={width}
          strokeDasharray={dash}
          markerEnd={`url(#${marker})`}
        />
      </svg>
      {children}
    </span>
  );
}

function Legend({ isolated }: { isolated: boolean }) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 hidden max-w-[calc(100%-1.5rem)] select-none flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface/95 px-2.5 py-1.5 text-[0.6875rem] text-muted-foreground shadow-sm backdrop-blur sm:flex">
      <LegendLine
        width={2}
        marker="arrow-handoff"
        className="stroke-foreground"
      >
        Handoff between modules
      </LegendLine>
      <LegendLine
        width={1.25}
        marker="arrow-feeds"
        className="stroke-border-strong"
      >
        Feeds into
      </LegendLine>
      <LegendLine
        width={1}
        dash="1 4"
        marker="arrow-shared"
        className="stroke-border-strong"
      >
        Shared master data
      </LegendLine>
      <LegendLine
        width={1.25}
        dash="5 4"
        marker="arrow-auto"
        className="stroke-border-strong"
      >
        Written automatically
      </LegendLine>
      <span className="hidden lg:inline">
        {isolated
          ? "Esc returns to the full map"
          : "Flow runs top to bottom · drag to pan · ⌘/Ctrl + scroll to zoom"}
      </span>
    </div>
  );
}
