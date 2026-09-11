"use client";

import * as React from "react";
import {
  computeLayout,
  type GraphLayout,
  type LayoutInput,
} from "@/lib/architecture-layout";

const EMPTY: GraphLayout = { nodes: [], edges: [], width: 0, height: 0 };

/**
 * ELK runs asynchronously (and takes ~350ms for the full 73-node graph), so the
 * previous drawing is held on screen while a new one is computed. Swapping to an
 * empty canvas mid-toggle would make every collapse flash.
 */
export function useGraphLayout(input: LayoutInput) {
  const [layout, setLayout] = React.useState<GraphLayout>(EMPTY);
  const [isComputing, setComputing] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // The node list is rebuilt on every render upstream, so identity is useless
  // as a dependency — key off the actual contents instead.
  const signature = React.useMemo(
    () =>
      [
        input.withLabels ? "L" : "-",
        input.nodes
          .map(node => node.id)
          .sort()
          .join(","),
        input.relations
          .map(relation => `${relation.from}>${relation.to}`)
          .sort()
          .join(","),
      ].join("|"),
    [input.nodes, input.relations, input.withLabels]
  );

  const latest = React.useRef(input);
  latest.current = input;

  React.useEffect(() => {
    let cancelled = false;
    setComputing(true);

    computeLayout(latest.current)
      .then(next => {
        if (cancelled) return;
        setLayout(next);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Layout failed");
      })
      .finally(() => {
        if (!cancelled) setComputing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [signature]);

  return { layout, isComputing, error };
}
