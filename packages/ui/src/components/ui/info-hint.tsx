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

export function InfoHint({
  label,
  className,
  side = "top",
  align = "center",
}: {
  label: React.ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  if (!label) return null;

  const accessibleText = typeof label === "string" ? label : undefined;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
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
