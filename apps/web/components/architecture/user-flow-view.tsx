"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import { ArrowRight, ChevronDown, ChevronRight } from "@repo/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import type { FlowStep, UserFlow } from "@/lib/architecture-map";

/**
 * Flows are read from the same structured data as the architecture map, so a
 * step can only point at a route the application really has.
 */
export function UserFlowView({
  flows,
  collapsed,
  onToggleCollapse,
  focusRequest,
}: {
  flows: UserFlow[];
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  focusRequest: { id: string; nonce: number } | null;
}) {
  const [highlightId, setHighlightId] = React.useState<string | null>(null);
  const refs = React.useRef(new Map<string, HTMLElement | null>());

  React.useEffect(() => {
    if (!focusRequest) return;
    const element = refs.current.get(focusRequest.id);
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightId(focusRequest.id);
    const timer = window.setTimeout(() => setHighlightId(null), 2200);
    return () => window.clearTimeout(timer);
  }, [focusRequest]);

  const categories = React.useMemo(() => {
    const order: UserFlow["category"][] = [
      "Access",
      "Marketing & Sales",
      "Operations",
      "Finance",
      "Admin",
    ];
    return order
      .map(category => ({
        category,
        items: flows.filter(flow => flow.category === category),
      }))
      .filter(group => group.items.length > 0);
  }, [flows]);

  if (!flows.length) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-surface-subtle p-8 text-center text-sm text-muted-foreground">
        No flows match your search.
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-5 overflow-y-auto rounded-lg border border-border bg-surface-subtle p-3">
      <FlowLegend />

      {categories.map(group => (
        <section key={group.category} className="space-y-2">
          <h2 className="px-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {group.category}
          </h2>

          <div className="space-y-2">
            {group.items.map(flow => {
              const isCollapsed = collapsed.has(flow.id);
              return (
                <article
                  key={flow.id}
                  ref={element => {
                    refs.current.set(flow.id, element);
                  }}
                  className={cn(
                    "overflow-hidden rounded-md border border-border bg-surface transition-shadow",
                    highlightId === flow.id &&
                      "ring-2 ring-ring ring-offset-2 ring-offset-surface-subtle"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onToggleCollapse(flow.id)}
                    aria-expanded={!isCollapsed}
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.8125rem] font-semibold leading-5 text-foreground">
                        {flow.title}
                      </span>
                      <span className="mt-0.5 block text-[0.6875rem] leading-4 text-muted-foreground">
                        {flow.summary}
                      </span>
                    </span>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[0.625rem] tabular-nums text-muted-foreground">
                      {flow.steps.length}
                    </span>
                  </button>

                  {!isCollapsed ? (
                    <ol className="flex flex-col gap-1.5 border-t border-border-subtle p-3 lg:flex-row lg:flex-wrap lg:items-stretch">
                      {flow.steps.map((step, index) => (
                        <li
                          key={step.id}
                          className="flex min-w-0 items-center gap-1.5 lg:contents"
                        >
                          <StepCard step={step} />
                          {index < flow.steps.length - 1 ? (
                            <ArrowRight
                              aria-hidden="true"
                              className="hidden size-3.5 shrink-0 self-center text-muted-foreground lg:block"
                            />
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

const STEP_LABEL: Record<FlowStep["kind"], string> = {
  start: "Starting point",
  action: "Someone does this",
  auto: "The system does this on its own",
  decision: "A branch — the answer changes what happens next",
  end: "Where the flow ends",
};

function StepCard({ step }: { step: FlowStep }) {
  const base = cn(
    "flex min-h-11 w-full min-w-0 flex-col justify-center gap-0.5 rounded-md border px-2.5 py-1.5 text-left outline-none transition-[background-color,border-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-ring/50 lg:w-[13.5rem]",
    step.kind === "decision"
      ? "border-dashed border-border-strong bg-surface-subtle"
      : step.kind === "auto"
        ? "border-dashed border-border bg-surface-subtle"
        : step.kind === "start" || step.kind === "end"
          ? "border-border-strong bg-muted"
          : "border-border bg-surface",
    step.route &&
      "cursor-pointer hover:-translate-y-px hover:border-border-strong hover:shadow-sm"
  );

  const body = (
    <>
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="shrink-0 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
          {step.kind === "auto"
            ? "auto"
            : step.kind === "decision"
              ? "if"
              : step.kind === "start"
                ? "start"
                : step.kind === "end"
                  ? "done"
                  : ""}
        </span>
        <span className="min-w-0 text-[0.78125rem] font-medium leading-4 text-foreground">
          {step.label}
        </span>
      </span>
      {step.note ? (
        <span className="text-[0.6875rem] leading-4 text-muted-foreground">
          {step.note}
        </span>
      ) : null}
    </>
  );

  const content = step.route ? (
    <Link href={step.route} className={base}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="min-w-0 flex-1 lg:flex-none">{content}</div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[16rem]">
          <span className="block">{STEP_LABEL[step.kind]}</span>
          {step.route ? (
            <span className="mt-0.5 block opacity-90">Opens {step.route}</span>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function FlowLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[0.6875rem] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm border border-border bg-surface" />
        Someone clicks
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm border border-dashed border-border bg-surface-subtle" />
        Automatic
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm border border-dashed border-border-strong bg-surface-subtle" />
        Branch
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm border border-border-strong bg-muted" />
        Start or end
      </span>
    </div>
  );
}
