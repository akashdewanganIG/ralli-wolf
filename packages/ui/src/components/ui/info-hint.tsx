"use client";

import * as React from "react";

import { Info } from "@repo/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { cn } from "@repo/ui/lib/utils";

/**
 * The supplementary half of a "title + description" pair.
 *
 * Card descriptions explain what a panel is, which matters the first time and
 * is noise every time after. Folding them behind an info icon keeps the
 * explanation one hover away while giving the card back a single-line header.
 *
 * It is a real `<button>`, not a hoverable `<span>`: Radix opens the tooltip on
 * focus as well as hover, so the text is reachable from the keyboard, and
 * screen readers get it through `aria-label` whether or not the tooltip opens.
 *
 * Do not use this for anything a person needs in order to complete the action
 * in front of them — required formats, destructive warnings, and field
 * constraints stay visible.
 */
export function InfoHint({
  label,
  className,
  side = "top",
  align = "center",
}: {
  /** The description that used to sit under the title. */
  label: React.ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  if (!label) return null;

  // Screen readers get the text directly; the tooltip is the visual affordance.
  const accessibleText = typeof label === "string" ? label : undefined;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            // `tabIndex` is implicit, but the explicit aria-label matters:
            // without it the control announces as an unnamed button.
            aria-label={
              accessibleText
                ? `More information: ${accessibleText}`
                : "More information"
            }
            className={cn(
              "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30",
              className
            )}
          >
            <Info aria-hidden="true" className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} align={align} className="max-w-[18rem]">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
