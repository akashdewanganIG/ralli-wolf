"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@repo/ui/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

/**
 * Tooltip surface, arrow included.
 *
 * The arrow is part of `TooltipContent` rather than something each call site
 * adds, so there is no way to render a tooltip without one — that is what keeps
 * the treatment identical across the dashboard instead of drifting per screen.
 *
 * Radix positions and rotates the arrow itself from the resolved side, so it
 * follows the tooltip when collision detection flips it from top to bottom.
 * It is filled with the same token as the surface so the two read as one shape,
 * and it is `pointer-events: none` (Radix's default for `Arrow`) so it can
 * never sit between the pointer and the trigger.
 */
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
    /** Escape hatch for a tooltip that must not draw an arrow. */
    hideArrow?: boolean;
  }
>(
  (
    { className, sideOffset = 6, hideArrow = false, children, ...props },
    ref
  ) => (
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-xs rounded-md bg-foreground px-2.5 py-1.5 text-xs leading-4 text-background shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1",
        className
      )}
      {...props}
    >
      {children}
      {hideArrow ? null : (
        <TooltipPrimitive.Arrow
          // 11x5 keeps the arrow legible without turning into a speech bubble.
          width={11}
          height={5}
          // The arrow sits between the surface and the trigger; letting it take
          // pointer events would put a hit target in the gap the user is moving
          // through.
          className="pointer-events-none fill-foreground"
        />
      )}
    </TooltipPrimitive.Content>
  )
);
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
