import * as React from "react";
import { cn } from "@repo/ui/lib/utils";

export function SidebarGroup({
  title,
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement> & { title?: string }) {
  return (
    <div className={cn("mb-3", className)}>
      {title && (
        <h4 className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </h4>
      )}
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}
