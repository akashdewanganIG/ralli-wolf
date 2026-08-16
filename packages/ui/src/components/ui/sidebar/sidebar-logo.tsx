import * as React from "react";
import { cn } from "@repo/ui/lib/utils";

export function SidebarLogo({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-2 p-4", className)}>
      {children}
    </div>
  );
}
