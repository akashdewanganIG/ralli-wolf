import * as React from "react";
import { cn } from "@repo/ui/lib/utils";
import { useSidebar } from "./sidebar-provider";

export function Sidebar({
  className,
  children,
  // TypeScript validates this inherited DOM prop; the legacy prop-types rule cannot infer it.
  // eslint-disable-next-line react/prop-types
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { open } = useSidebar();
  return (
    <aside
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out",
        // Sized to the longest module name in the navigation rather than to a
        // round number, so labels read in full instead of ellipsing.
        open ? "w-[15.75rem]" : "w-14",
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </aside>
  );
}
