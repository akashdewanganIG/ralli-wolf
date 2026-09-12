/**
 * Geometry for the architecture diagram.
 *
 * The previous renderer placed nodes in fixed columns and drew beziers between
 * box edges, which crossed constantly and read as a tangle. This computes a
 * real layered graph drawing instead — ELK's `layered` algorithm (Sugiyama:
 * cycle break, layer assignment, crossing minimisation, coordinate assignment)
 * with orthogonal edge routing.
 *
 * One decision matters more than all the option tuning: the graph is laid out
 * FLAT. Measured over the real data, nesting modules and sections as ELK
 * container nodes produced 55-97 edge crossings and 15-37 edge segments cutting
 * through unrelated boxes, because containers pin nodes far from the things
 * they connect to. Laying the leaves out flat and letting ELK order them by
 * flow gives 10 crossings and zero segments through a node, in every collapse
 * and isolate case. Module identity is therefore shown on the node itself and
 * in grouping bands drawn behind the result — never as a layout constraint.
 */

import type { ArchNode, ArchRelation, FlowStep } from "./architecture-map";

export interface LayoutBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutEdge {
  id: string;
  relation: ArchRelation;
  /** Orthogonal polyline from source port to target port. */
  points: Array<{ x: number; y: number }>;
  /** Where the edge label sits, if one was placed. */
  label?: { x: number; y: number; w: number; h: number };
}

export interface GraphLayout {
  nodes: LayoutBox[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

export const NODE_W = 210;
export const NODE_H = 50;

/** Roughly the advance width of the 9px label type, for reserving label space. */
const LABEL_CHAR_W = 5.0;
const LABEL_H = 16;
const MAX_LABEL_CHARS = 34;

/**
 * Tuned by sweeping every combination of direction, placement strategy and
 * routing over the real graph and scoring crossings, segments through nodes and
 * aspect ratio. DOWN + NETWORK_SIMPLEX + ORTHOGONAL won on every measure.
 */
const LAYOUT_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.cycleBreaking.strategy": "GREEDY",
  // The graph is small; buying extra crossing-minimisation sweeps is cheap.
  "elk.layered.thoroughness": "60",
  "elk.spacing.nodeNode": "26",
  "elk.spacing.edgeNode": "22",
  "elk.spacing.edgeEdge": "14",
  "elk.spacing.edgeLabel": "6",
  "elk.layered.spacing.nodeNodeBetweenLayers": "86",
  "elk.layered.spacing.edgeNodeBetweenLayers": "26",
  "elk.layered.spacing.edgeEdgeBetweenLayers": "14",
  "elk.layered.edgeLabels.sideSelection": "SMART_DOWN",
  "elk.edgeLabels.placement": "CENTER",
};

export interface LayoutInput {
  /** Leaf nodes to draw. Modules and sections are not laid out. */
  nodes: ArchNode[];
  relations: ArchRelation[];
  /** Reserve space for edge labels. Off for the dense full map. */
  withLabels: boolean;
}

interface ElkPoint {
  x: number;
  y: number;
}
interface ElkSection {
  startPoint: ElkPoint;
  endPoint: ElkPoint;
  bendPoints?: ElkPoint[];
}
interface ElkLabel {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}
interface ElkEdge {
  id: string;
  sections?: ElkSection[];
  labels?: ElkLabel[];
}
interface ElkNode {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: ElkNode[];
  edges?: ElkEdge[];
}

type ElkConstructor = new () => {
  layout: (graph: unknown) => Promise<ElkNode>;
};

let elkPromise: Promise<ElkConstructor> | null = null;

/** Loaded on demand so the ~1.4MB layout engine never enters the initial bundle. */
async function loadElk(): Promise<ElkConstructor> {
  if (!elkPromise) {
    elkPromise = import("elkjs/lib/elk.bundled.js").then(
      module =>
        ((module as unknown as { default: ElkConstructor }).default ??
          module) as ElkConstructor
    );
  }
  return elkPromise;
}

function truncate(text: string): string {
  return text.length > MAX_LABEL_CHARS
    ? `${text.slice(0, MAX_LABEL_CHARS - 1)}…`
    : text;
}

export async function computeLayout({
  nodes,
  relations,
  withLabels,
}: LayoutInput): Promise<GraphLayout> {
  const present = new Set(nodes.map(node => node.id));
  const drawn = relations.filter(
    relation => present.has(relation.from) && present.has(relation.to)
  );

  if (!nodes.length) return { nodes: [], edges: [], width: 0, height: 0 };

  const Elk = await loadElk();
  const graph = {
    id: "root",
    layoutOptions: LAYOUT_OPTIONS,
    children: nodes.map(node => ({
      id: node.id,
      width: NODE_W,
      height: NODE_H,
    })),
    edges: drawn.map((relation, index) => ({
      id: `edge-${index}`,
      sources: [relation.from],
      targets: [relation.to],
      ...(withLabels
        ? {
            labels: [
              {
                text: truncate(relation.label),
                width: truncate(relation.label).length * LABEL_CHAR_W + 10,
                height: LABEL_H,
              },
            ],
          }
        : {}),
    })),
  };

  const result = await new Elk().layout(graph);

  const boxes: LayoutBox[] = (result.children ?? []).map(child => ({
    id: child.id,
    x: child.x ?? 0,
    y: child.y ?? 0,
    w: child.width ?? NODE_W,
    h: child.height ?? NODE_H,
  }));

  const edges: LayoutEdge[] = [];
  for (const edge of result.edges ?? []) {
    const index = Number(edge.id.replace("edge-", ""));
    const relation = drawn[index];
    const section = edge.sections?.[0];
    if (!relation || !section) continue;

    const points = [
      section.startPoint,
      ...(section.bendPoints ?? []),
      section.endPoint,
    ].map(point => ({ x: point.x, y: point.y }));

    const rawLabel = edge.labels?.[0];
    const label =
      rawLabel &&
      typeof rawLabel.x === "number" &&
      typeof rawLabel.y === "number"
        ? {
            x: rawLabel.x,
            y: rawLabel.y,
            w: rawLabel.width ?? 0,
            h: rawLabel.height ?? LABEL_H,
          }
        : undefined;

    edges.push({ id: edge.id, relation, points, label });
  }

  return {
    nodes: boxes,
    edges,
    width: result.width ?? 0,
    height: result.height ?? 0,
  };
}

/**
 * Turns an orthogonal polyline into an SVG path with rounded elbows. Square
 * corners read as harsh at this scale; a small radius keeps the engineered
 * right-angle look while staying easy on the eye.
 */
export function orthogonalPath(
  points: Array<{ x: number; y: number }>,
  radius = 8
): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  }

  const parts: string[] = [`M ${points[0]!.x} ${points[0]!.y}`];

  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1]!;
    const corner = points[i]!;
    const next = points[i + 1]!;

    const inLength = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const outLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    // Never round more than half of either adjacent segment, or short segments
    // would overshoot and the path would double back on itself.
    const r = Math.max(0, Math.min(radius, inLength / 2, outLength / 2));

    if (r < 0.5) {
      parts.push(`L ${corner.x} ${corner.y}`);
      continue;
    }

    const enter = {
      x: corner.x - ((corner.x - previous.x) / inLength) * r,
      y: corner.y - ((corner.y - previous.y) / inLength) * r,
    };
    const exit = {
      x: corner.x + ((next.x - corner.x) / outLength) * r,
      y: corner.y + ((next.y - corner.y) / outLength) * r,
    };

    parts.push(`L ${enter.x} ${enter.y}`);
    parts.push(`Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`);
  }

  const last = points[points.length - 1]!;
  parts.push(`L ${last.x} ${last.y}`);
  return parts.join(" ");
}

/* ------------------------------------------------------------------ */
/* User flows                                                          */
/* ------------------------------------------------------------------ */

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  /** Branch label ("yes", "Email", …). Absent on a plain sequential step. */
  label?: string;
  points: Array<{ x: number; y: number }>;
  labelBox?: { x: number; y: number; w: number; h: number };
}

export interface FlowLayout {
  nodes: LayoutBox[];
  edges: FlowEdge[];
  width: number;
  height: number;
}

export const FLOW_W = 232;
export const FLOW_H = 58;
/** Decisions get a little more room; a fork needs to read as a fork. */
export const FLOW_DECISION_H = 66;

const FLOW_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  // Flows loop back (re-add a component, reschedule, pick another method), so
  // the cycle breaker has to run before layering.
  "elk.layered.cycleBreaking.strategy": "GREEDY",
  "elk.layered.thoroughness": "40",
  "elk.spacing.nodeNode": "28",
  "elk.spacing.edgeNode": "24",
  "elk.spacing.edgeEdge": "16",
  "elk.spacing.edgeLabel": "6",
  "elk.layered.spacing.nodeNodeBetweenLayers": "56",
  "elk.layered.spacing.edgeNodeBetweenLayers": "24",
  "elk.edgeLabels.placement": "CENTER",
  "elk.layered.edgeLabels.sideSelection": "SMART_DOWN",
};

/**
 * Derives the edges of a flow from its steps.
 *
 * A step leads to its branches if it has any, else to `next` if set, else to
 * whatever follows it in the array. An `end` step leads nowhere — which is what
 * lets the terminal outcomes sit at the bottom of the array without the step
 * above them accidentally pointing at one.
 */
export function flowEdges(
  steps: FlowStep[]
): Array<{ from: string; to: string; label?: string }> {
  const present = new Set(steps.map(step => step.id));
  const edges: Array<{ from: string; to: string; label?: string }> = [];

  steps.forEach((step, index) => {
    if (step.kind === "end") return;

    if (step.branches?.length) {
      for (const branch of step.branches) {
        if (present.has(branch.to))
          edges.push({ from: step.id, to: branch.to, label: branch.label });
      }
      return;
    }

    const target = step.next ?? steps[index + 1]?.id;
    if (target && present.has(target))
      edges.push({ from: step.id, to: target });
  });

  return edges;
}

export async function computeFlowLayout(
  steps: FlowStep[]
): Promise<FlowLayout> {
  if (!steps.length) return { nodes: [], edges: [], width: 0, height: 0 };

  const derived = flowEdges(steps);
  const Elk = await loadElk();

  const graph = {
    id: "root",
    layoutOptions: FLOW_OPTIONS,
    children: steps.map(step => ({
      id: step.id,
      width: FLOW_W,
      height: step.kind === "decision" ? FLOW_DECISION_H : FLOW_H,
    })),
    edges: derived.map((edge, index) => ({
      id: `flow-${index}`,
      sources: [edge.from],
      targets: [edge.to],
      ...(edge.label
        ? {
            labels: [
              {
                text: edge.label,
                width: edge.label.length * 5.4 + 12,
                height: 15,
              },
            ],
          }
        : {}),
    })),
  };

  const result = await new Elk().layout(graph);

  const nodes: LayoutBox[] = (result.children ?? []).map(child => ({
    id: child.id,
    x: child.x ?? 0,
    y: child.y ?? 0,
    w: child.width ?? FLOW_W,
    h: child.height ?? FLOW_H,
  }));

  const edges: FlowEdge[] = [];
  for (const raw of result.edges ?? []) {
    const index = Number(raw.id.replace("flow-", ""));
    const source = derived[index];
    const section = raw.sections?.[0];
    if (!source || !section) continue;

    const points = [
      section.startPoint,
      ...(section.bendPoints ?? []),
      section.endPoint,
    ].map(point => ({ x: point.x, y: point.y }));

    const rawLabel = raw.labels?.[0];
    edges.push({
      id: raw.id,
      from: source.from,
      to: source.to,
      label: source.label,
      points,
      labelBox:
        rawLabel &&
        typeof rawLabel.x === "number" &&
        typeof rawLabel.y === "number"
          ? {
              x: rawLabel.x,
              y: rawLabel.y,
              w: rawLabel.width ?? 0,
              h: rawLabel.height ?? 15,
            }
          : undefined,
    });
  }

  return {
    nodes,
    edges,
    width: result.width ?? 0,
    height: result.height ?? 0,
  };
}
