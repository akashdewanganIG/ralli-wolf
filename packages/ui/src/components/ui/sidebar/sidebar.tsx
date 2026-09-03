import * as React from "react";
import { cn } from "@repo/ui/lib/utils";
import { useSidebar } from "./sidebar-provider";

export function Sidebar({
  className,
  children,

  // eslint-disable-next-line react/prop-types
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { open } = useSidebar();
  return (
    <aside
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out",

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
