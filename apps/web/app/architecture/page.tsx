"use client";

import * as React from "react";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { PageHeader } from "@repo/ui/components/ui/page-header";
import { Input } from "@repo/ui/components/ui/input";
import { cn } from "@repo/ui/lib/utils";
import { Search, X } from "@repo/ui/icons";
import { ProtectedRoute } from "@/components/protected-route";
import { useIsAdmin } from "@/components/guards/role-guard";
import { ArchitectureView } from "@/components/architecture/architecture-view";
import { ArchitectureOutline } from "@/components/architecture/architecture-outline";
import { UserFlowView } from "@/components/architecture/user-flow-view";
import {
  ARCH_NODES,
  ARCH_RELATIONS,
  USER_FLOWS,
  ancestorsOf,
  type ArchNode,
} from "@/lib/architecture-map";

type ViewMode = "architecture" | "flows";

interface SearchHit {
  id: string;
  label: string;
  context: string;
  kind: "node" | "flow";
}

/** Matches the `lg` breakpoint the diagram layout is designed for. */
function useIsWideScreen() {
  const [isWide, setIsWide] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isWide;
}

export default function ArchitecturePage() {
  const isAdmin = useIsAdmin();
  const isWide = useIsWideScreen();

  const [view, setView] = React.useState<ViewMode>("architecture");
  const [query, setQuery] = React.useState("");
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [focusRequest, setFocusRequest] = React.useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const [showAllConnections, setShowAllConnections] = React.useState(false);
  const [resultsOpen, setResultsOpen] = React.useState(false);

  /* ---------- permissions: never show what the user cannot open ---------- */

  const visibleNodes = React.useMemo(
    () => ARCH_NODES.filter(node => !node.adminOnly || isAdmin),
    [isAdmin]
  );

  const visibleIds = React.useMemo(
    () => new Set(visibleNodes.map(node => node.id)),
    [visibleNodes]
  );

  const nodesByParent = React.useMemo(() => {
    const map = new Map<string | null, ArchNode[]>();
    for (const node of visibleNodes) {
      const bucket = map.get(node.parent) ?? [];
      bucket.push(node);
      map.set(node.parent, bucket);
    }
    return map;
  }, [visibleNodes]);

  const modules = React.useMemo(
    () =>
      visibleNodes.filter(
        node =>
          node.kind === "module" &&
          (nodesByParent.get(node.id) ?? []).length > 0
      ),
    [visibleNodes, nodesByParent]
  );

  const relations = React.useMemo(
    () =>
      ARCH_RELATIONS.filter(
        relation => visibleIds.has(relation.from) && visibleIds.has(relation.to)
      ),
    [visibleIds]
  );

  const flows = React.useMemo(
    () =>
      USER_FLOWS.map(flow => ({
        ...flow,
        steps: flow.steps.filter(step => !step.adminOnly || isAdmin),
      })).filter(flow => flow.steps.length > 0),
    [isAdmin]
  );

  /* ---------- search ---------- */

  const hits = React.useMemo<SearchHit[]>(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 2) return [];
    const tokens = trimmed.split(/\s+/).filter(Boolean);

    const matches = (haystack: string) =>
      tokens.every(token => haystack.includes(token));

    const nodeHits: SearchHit[] = visibleNodes
      .filter(
        node =>
          node.kind === "page" ||
          node.kind === "concept" ||
          node.kind === "external"
      )
      .filter(node =>
        matches(
          [
            node.label,
            node.description,
            ...(node.keywords ?? []),
            node.route ?? "",
          ]
            .join(" ")
            .toLowerCase()
        )
      )
      .map(node => ({
        id: node.id,
        label: node.label,
        context:
          node.route ??
          (node.kind === "concept" ? "Concept — no page" : "Integration"),
        kind: "node" as const,
      }));

    const flowHits: SearchHit[] = flows
      .filter(flow => matches(`${flow.title} ${flow.summary}`.toLowerCase()))
      .map(flow => ({
        id: flow.id,
        label: flow.title,
        context: `${flow.category} flow`,
        kind: "flow" as const,
      }));

    return [...nodeHits, ...flowHits].slice(0, 8);
  }, [query, visibleNodes, flows]);

  const toggleCollapse = React.useCallback((id: string) => {
    setCollapsed(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Reveals a hit without navigating — the user still has to click the node. */
  const revealHit = React.useCallback((hit: SearchHit) => {
    if (hit.kind === "flow") {
      // Flows are selected, not expanded — the view picks it up from focusRequest.
      setView("flows");
    } else {
      setView("architecture");
      setCollapsed(current => {
        const next = new Set(current);
        for (const ancestor of ancestorsOf(hit.id)) next.delete(ancestor);
        return next;
      });
    }
    setResultsOpen(false);
    setFocusRequest({ id: hit.id, nonce: Date.now() });
  }, []);

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Architecture & User Flow"
          description="An interactive map of the platform — every module, how they connect, and the real workflows that run through them. Nodes open the page they represent."
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="tablist"
            aria-label="Diagram view"
            className="inline-flex w-full shrink-0 rounded-md border border-border bg-surface p-0.5 sm:w-auto"
          >
            {(
              [
                ["architecture", "Architecture"],
                ["flows", "User flows"],
              ] as Array<[ViewMode, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                type="button"
                aria-selected={view === value}
                onClick={() => setView(value)}
                className={cn(
                  "flex-1 rounded px-3 py-1.5 text-[0.78125rem] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 sm:flex-none",
                  view === value
                    ? "bg-selected text-selected-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            {view === "architecture" && isWide ? (
              <button
                type="button"
                onClick={() => setShowAllConnections(current => !current)}
                aria-pressed={showAllConnections}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-[0.75rem] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
                  showAllConnections
                    ? "border-border-strong bg-selected text-selected-foreground"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground"
                )}
              >
                All connections
              </button>
            ) : null}

            <div className="relative w-full min-w-0 sm:w-72">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={event => {
                  setQuery(event.target.value);
                  setResultsOpen(true);
                }}
                onFocus={() => setResultsOpen(true)}
                onBlur={() =>
                  window.setTimeout(() => setResultsOpen(false), 120)
                }
                onKeyDown={event => {
                  if (event.key === "Escape") {
                    setResultsOpen(false);
                  }
                  if (event.key === "Enter" && hits[0]) {
                    event.preventDefault();
                    revealHit(hits[0]);
                  }
                }}
                placeholder="Find a module or page…"
                aria-label="Search the architecture map"
                className="h-9 pl-8 pr-8"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setResultsOpen(false);
                  }}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}

              {resultsOpen && hits.length ? (
                <ul className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-30 overflow-hidden rounded-md border border-border bg-surface shadow-md">
                  {hits.map(hit => (
                    <li key={`${hit.kind}:${hit.id}`}>
                      <button
                        type="button"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => revealHit(hit)}
                        className="flex w-full items-baseline justify-between gap-2 px-2.5 py-1.5 text-left outline-none transition-colors hover:bg-hover focus-visible:bg-hover"
                      >
                        <span className="min-w-0 truncate text-[0.78125rem] text-foreground">
                          {hit.label}
                        </span>
                        <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
                          {hit.context}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex h-[clamp(26rem,72svh,58rem)] min-h-0 flex-col">
          {view === "flows" ? (
            <UserFlowView flows={flows} focusRequest={focusRequest} />
          ) : isWide ? (
            <ArchitectureView
              modules={modules}
              nodesByParent={nodesByParent}
              relations={relations}
              collapsed={collapsed}
              onToggleCollapse={toggleCollapse}
              focusRequest={focusRequest}
              showAllConnections={showAllConnections}
            />
          ) : (
            <ArchitectureOutline
              modules={modules}
              nodesByParent={nodesByParent}
              relations={relations}
              collapsed={collapsed}
              onToggleCollapse={toggleCollapse}
              focusRequest={focusRequest}
            />
          )}
        </div>
      </PageShell>
    </ProtectedRoute>
  );
}
