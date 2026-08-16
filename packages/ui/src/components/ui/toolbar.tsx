import * as React from "react";
import { cn } from "@repo/ui/lib/utils";

export function SearchFilterToolbar({
  search,
  filters,
  actions,
  className,
}: {
  search: React.ReactNode;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-2 lg:flex-row lg:items-center",
        className
      )}
    >
      <div className="min-w-0 flex-1">{search}</div>
      {filters ? (
        <div className="grid min-w-0 grid-cols-1 items-center gap-2 sm:grid-cols-2 lg:flex lg:shrink-0 lg:flex-nowrap [&>*]:min-w-0">
          {filters}
        </div>
      ) : null}
      {actions ? (
        <div className="grid shrink-0 grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap [&>*]:min-w-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
