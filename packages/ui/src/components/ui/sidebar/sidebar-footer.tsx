"use client";

import * as React from "react";
import { cn } from "@repo/ui/lib/utils";
import { useSidebar } from "./sidebar-provider";

export function SidebarFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { open } = useSidebar();
  return (
    <div
      className={cn(
        "flex min-h-12 items-center border-t border-sidebar-border px-4 py-3",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "transition-opacity duration-150 ease-in-out w-full",
          !open && "opacity-0 overflow-hidden"
        )}
      >
        {children}
      </div>
    </div>
  );
}
