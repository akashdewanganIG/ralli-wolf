"use client";

import * as React from "react";

import { Activity } from "@repo/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../tooltip";
import { cn } from "@repo/ui/lib/utils";
import { MENU_ITEM } from "@repo/ui/components/ui/form-control";

/**
 * How a service is doing, worst-last.
 *
 * The order matters — `worstLevel` folds a list of entries down to the single
 * state the header dot has to show, and it does that by taking the maximum
 * along this scale.
 */
export type StatusLevel =
  | "healthy"
  | "pending"
  | "warning"
  | "offline"
  | "error"
  | "unknown";

const LEVEL_RANK: Record<StatusLevel, number> = {
  healthy: 0,
  unknown: 1,
  pending: 2,
  warning: 3,
  offline: 4,
  error: 5,
};

/**
 * Small dots, not filled rows.
 *
 * A status list where every line carries a coloured background is unreadable at
 * a glance: the eye has nothing to lock onto because everything is emphasised.
 * The dot is the only coloured element, so scanning for a non-green one works.
 */
const LEVEL_DOT: Record<StatusLevel, string> = {
  healthy: "bg-success",
  pending: "bg-info",
  warning: "bg-warning",
  offline: "bg-muted-foreground",
  error: "bg-error",
  unknown: "bg-muted-foreground",
};

const LEVEL_TEXT: Record<StatusLevel, string> = {
  healthy: "text-success-foreground",
  pending: "text-info-foreground",
  warning: "text-warning-foreground",
  offline: "text-muted-foreground",
  error: "text-error-foreground",
  unknown: "text-muted-foreground",
};

const LEVEL_LABEL: Record<StatusLevel, string> = {
  healthy: "Healthy",
  pending: "Pending",
  warning: "Warning",
  offline: "Offline",
  error: "Error",
  unknown: "Unknown",
};

export interface SystemStatusEntry {
  id: string;
  label: string;
  level: StatusLevel;
  /** Short state text shown on the right, e.g. "Synced 14:02". */
  detail?: string;
  /** Technical detail, revealed on hover/focus of the row. */
  tooltip?: string;
}

export interface SystemStatusGroup {
  id: string;
  label: string;
  entries: SystemStatusEntry[];
}

export function worstLevel(groups: SystemStatusGroup[]): StatusLevel {
  let worst: StatusLevel = "healthy";
  for (const group of groups) {
    for (const entry of group.entries) {
      if (LEVEL_RANK[entry.level] > LEVEL_RANK[worst]) worst = entry.level;
    }
  }
  return worst;
}

function StatusRow({ entry }: { entry: SystemStatusEntry }) {
  const row = (
    <div className={cn(MENU_ITEM, "justify-between gap-3")}>
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            LEVEL_DOT[entry.level]
          )}
        />
        <span className="truncate text-[0.8125rem] leading-5 text-foreground">
          {entry.label}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 text-[0.6875rem] font-medium leading-4 tabular-nums",
          LEVEL_TEXT[entry.level]
        )}
      >
        {entry.detail ?? LEVEL_LABEL[entry.level]}
      </span>
    </div>
  );

  if (!entry.tooltip) {
    return (
      <div>
        <span className="sr-only">{`${entry.label}: ${LEVEL_LABEL[entry.level]}`}</span>
        {row}
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          aria-label={`${entry.label}: ${LEVEL_LABEL[entry.level]}. ${entry.tooltip}`}
        >
          {row}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[16rem]">
        {entry.tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * One place to read whether the application is working.
 *
 * Connectivity, database reachability, and per-service sync state used to be
 * scattered — a badge beside the page title, a pulsing dot above the metrics,
 * an online marker inside the account menu — which meant three places to look
 * and three things to keep in sync. They are all here now, and the trigger dot
 * summarises the worst of them so nothing has to be surfaced elsewhere just to
 * be noticed.
 */
export function SystemStatusDropdown({
  groups,
  summaryLabel,
  className,
}: {
  groups: SystemStatusGroup[];
  /** Overrides the derived summary line, e.g. while the first check runs. */
  summaryLabel?: string;
  className?: string;
}) {
  const level = worstLevel(groups);
  const isHealthy = level === "healthy";

  return (
    <TooltipProvider delayDuration={200}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground outline-none transition-[background-color,border-color,color] duration-150 hover:border-border-strong hover:bg-surface-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30",
              className
            )}
            aria-label={`System status: ${summaryLabel ?? LEVEL_LABEL[level]}`}
          >
            <Activity aria-hidden="true" className="size-4" />
            <span
              aria-hidden="true"
              className={cn(
                "absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-surface",
                LEVEL_DOT[level]
              )}
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className="w-[min(19rem,calc(100vw-2rem))] p-1"
          align="end"
          sideOffset={6}
        >
          <div className="flex items-center justify-between gap-3 px-2 py-1.5">
            <p className="text-[0.8125rem] font-semibold leading-5 text-foreground">
              System status
            </p>
            <span
              className={cn(
                "text-[0.6875rem] font-medium leading-4",
                LEVEL_TEXT[level]
              )}
            >
              {summaryLabel ??
                (isHealthy ? "All systems normal" : LEVEL_LABEL[level])}
            </span>
          </div>

          {groups.map((group, index) => (
            <div key={group.id}>
              <div
                className={cn(
                  "border-t border-border-subtle px-2 pb-1",
                  index === 0 ? "pt-2" : "pt-2"
                )}
              >
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  {group.label}
                </p>
              </div>
              <div className="pb-1">
                {group.entries.length ? (
                  group.entries.map(entry => (
                    <StatusRow key={entry.id} entry={entry} />
                  ))
                ) : (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    Nothing reported.
                  </p>
                )}
              </div>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
