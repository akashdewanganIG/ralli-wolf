import * as React from "react";

import { cn } from "@repo/ui/lib/utils";

/**
 * The one container every dashboard page opens with.
 *
 * Page padding used to be a convention — `<div className="space-y-5 p-4">`
 * copied into 46 files and normalised afterwards by a CSS rule that matched on
 * `.p-4`. That works until someone writes `p-5`, or wraps the page in another
 * padded div, and then the left edge of a table no longer lines up with the
 * heading above it. Declaring it once removes the opportunity.
 *
 * The horizontal padding here is the *only* horizontal padding on the page:
 * headers, toolbars, tables, and rows inside it are all edge-to-edge, so every
 * left edge agrees by construction rather than by each page getting it right.
 */
export function PageShell({
  children,
  className,
  /** Vertical rhythm between top-level sections. */
  gap = "default",
}: {
  children: React.ReactNode;
  className?: string;
  gap?: "default" | "tight";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[100rem] min-w-0",
        "px-4 pb-8 pt-5 sm:px-5",
        "flex flex-col",
        gap === "tight" ? "gap-3" : "gap-4",
        className
      )}
    >
      {children}
    </div>
  );
}
