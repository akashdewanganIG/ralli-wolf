"use client";

import * as React from "react";

import { cn } from "@repo/ui/lib/utils";

export function DashboardToolbar({
  search,
  actions,

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
          <div className="flex min-w-0 flex-wrap items-center gap-2 [&>*]:min-w-0 sm:[&>*]:w-auto">
            {actionList}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-wrap items-center gap-2",
        className
      )}
    >
      <div className="min-w-0 flex-1 basis-56">{search}</div>
      {actionList.map((action, index) => (
        <div key={index} className="shrink-0">
          {action}
        </div>
      ))}
    </div>
  );
}
