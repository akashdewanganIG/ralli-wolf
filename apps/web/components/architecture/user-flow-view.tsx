"use client";

import * as React from "react";
import { cn } from "@repo/ui/lib/utils";
import type { UserFlow } from "@/lib/architecture-map";
import { FlowChart } from "./flow-chart";

const CATEGORY_ORDER: UserFlow["category"][] = [
  "Access",
  "Marketing & Sales",
  "Operations",
  "Finance",
  "Admin",
];

/**
 * One flow at a time, drawn properly, rather than fourteen rows of chips. The
 * rail keeps the whole catalogue one click away and mirrors the categories the
 * flows are grouped under.
 */
export function UserFlowView({
  flows,
  focusRequest,
}: {
  flows: UserFlow[];
  focusRequest: { id: string; nonce: number } | null;
}) {
  const [selectedId, setSelectedId] = React.useState(flows[0]?.id ?? "");

  React.useEffect(() => {
    if (!focusRequest) return;
    if (flows.some(flow => flow.id === focusRequest.id))
      setSelectedId(focusRequest.id);
  }, [focusRequest, flows]);

  // A permission change can remove the selected flow from under us.
  React.useEffect(() => {
    if (flows.length && !flows.some(flow => flow.id === selectedId)) {
      setSelectedId(flows[0]!.id);
    }
  }, [flows, selectedId]);

  const grouped = React.useMemo(
    () =>
      CATEGORY_ORDER.map(category => ({
        category,
        items: flows.filter(flow => flow.category === category),
      })).filter(group => group.items.length > 0),
    [flows]
  );

  const selected = flows.find(flow => flow.id === selectedId) ?? flows[0];

  if (!selected) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-surface-subtle p-8 text-center text-sm text-muted-foreground">
        No flows match your search.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row">
      {/* Small screens: a horizontal strip, so the chart keeps the height. */}
      <div className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden">
        {flows.map(flow => (
          <button
            key={flow.id}
            type="button"
            onClick={() => setSelectedId(flow.id)}
            aria-pressed={flow.id === selected.id}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-[0.75rem] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
              flow.id === selected.id
                ? "border-border-strong bg-selected text-selected-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            )}
          >
            {flow.title}
          </button>
        ))}
      </div>

      <nav
        aria-label="User flows"
        className="hidden w-60 shrink-0 overflow-y-auto rounded-lg border border-border bg-surface p-1.5 lg:block xl:w-64"
      >
        {grouped.map(group => (
          <div key={group.category} className="mb-2 last:mb-0">
            <h3 className="px-2 py-1 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.category}
            </h3>
            <ul className="space-y-0.5">
              {group.items.map(flow => {
                const active = flow.id === selected.id;
                return (
                  <li key={flow.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(flow.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
                        active
                          ? "bg-selected text-selected-foreground"
                          : "text-foreground hover:bg-hover"
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-[0.78125rem] leading-4">
                        {flow.title}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[0.625rem] tabular-nums",
                          active
                            ? "text-selected-foreground/70"
                            : "text-muted-foreground"
                        )}
                      >
                        {flow.steps.length}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <header className="shrink-0 rounded-lg border border-border bg-surface px-3 py-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2 className="text-[0.875rem] font-semibold leading-5 text-foreground">
              {selected.title}
            </h2>
            <span className="text-[0.6875rem] text-muted-foreground">
              {selected.category} · {selected.steps.length} steps
            </span>
          </div>
          <p className="mt-0.5 text-[0.75rem] leading-4 text-muted-foreground">
            {selected.summary}
          </p>
        </header>

        <FlowChart key={selected.id} flow={selected} />
      </div>
    </div>
  );
}
