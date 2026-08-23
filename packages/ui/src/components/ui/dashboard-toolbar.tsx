"use client";

import * as React from "react";

import { cn } from "@repo/ui/lib/utils";

/**
 * The row of controls above a dashboard table.
 *
 * One layout rule, applied everywhere, replacing per-module arrangements that
 * left dead space or pushed two buttons onto their own line:
 *
 *   - the search takes every pixel the actions do not need;
 *   - up to two actions stay on the search's row;
 *   - three or more move to a second row, aligned to the same edges.
 *
 * The threshold is counted from the children actually passed, not guessed from
 * a breakpoint, so a screen with two actions never wraps early and a screen
 * with five never crowds. Nothing here sets a fixed width — the search is the
 * only flexible element and the actions size to their content, which is what
 * keeps the row free of gaps at any zoom level.
 */
export function DashboardToolbar({
  search,
  actions,
  /** Forces the two-row layout regardless of how many actions there are. */
  stack,
  className,
}: {
  search?: React.ReactNode;
  actions?: React.ReactNode;
  stack?: boolean;
  className?: string;
}) {
  const actionList = React.Children.toArray(actions).filter(Boolean);
  const count = actionList.length;
  const secondRow = stack ?? count > 2;

  if (!search) {
    return (
      <div
        className={cn(
          "flex w-full min-w-0 flex-wrap items-center gap-2",
          className
        )}
      >
        {actionList}
      </div>
    );
  }

  if (secondRow) {
    return (
      <div className={cn("flex w-full min-w-0 flex-col gap-2", className)}>
        <div className="min-w-0">{search}</div>
        {count ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {actionList}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        // Wraps only when the viewport genuinely cannot hold the row.
        "flex w-full min-w-0 flex-wrap items-center gap-2",
        className
      )}
    >
      {/* `flex-1 basis-56` lets the search shrink on a narrow screen and take
          the slack on a wide one, without a fixed width that would strand
          empty space beside it. */}
      <div className="min-w-0 flex-1 basis-56">{search}</div>
      {actionList.map((action, index) => (
        <div key={index} className="shrink-0">
          {action}
        </div>
      ))}
    </div>
  );
}
