import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@repo/ui/lib/utils";
import {
  CONTROL_HEIGHT,
  CONTROL_SQUARE,
} from "@repo/ui/components/ui/form-control";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-[0.8125rem] font-medium outline-none transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-150 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        /**
         * Every filled variant shares `.btn-dimensional`. Only the surface
         * colour differs — height, radius, typography, padding, icon size,
         * transition timing, and the depth model are identical, so the family
         * reads as one component wearing different semantics rather than as
         * several button designs.
         */
        default:
          "btn-dimensional relative overflow-hidden border border-primary/80 bg-primary text-primary-foreground hover:bg-primary/95",
        destructive:
          "btn-dimensional relative overflow-hidden border border-destructive/80 bg-destructive text-destructive-foreground hover:bg-destructive/95 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        success:
          "btn-dimensional relative overflow-hidden border border-success/80 bg-success text-success-on hover:bg-success/95",
        /**
         * Unfilled variants stay flat by design. A ghost or outline control has
         * no face to light, and giving it the same shadow would make an
         * secondary action compete with the primary one standing next to it.
         * They keep the family's geometry and timing.
         */
        outline:
          "border border-input bg-surface text-foreground hover:border-border-strong hover:bg-surface-subtle dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "border border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost:
          "border border-transparent hover:bg-secondary hover:text-foreground dark:hover:bg-accent/50",
        // No underline: the brand colour is red, so `hover:underline` drew a red
        // rule under the label. Colour alone carries the hover.
        link: "text-primary hover:text-info",
        /**
         * Dimensional primary action.
         *
         * The depth is four cheap layers, all in the brand hue so no new colour
         * enters the system: a top inner highlight, a bottom inner edge shade, a
         * soft drop shadow, and a faint same-hue sheen that lifts the centre.
         * Hover raises it a touch; press compresses it and flattens the shadow,
         * so the control reads as physically depressed. Everything is inset or
         * box-shadow rather than transforms on children, so nothing clips or
         * reflows at any zoom level.
         */
        raised: [
          "btn-raised relative overflow-hidden",
          "border border-primary/80 bg-primary text-primary-foreground",
          "hover:bg-primary/95",
        ].join(" "),
        /**
         * `raised`, sized for the foot of a card.
         *
         * The same lighting — it wears `btn-raised` itself rather than a
         * variant of it. It used to carry a `btn-card-action` hook that no
         * stylesheet ever defined, so these buttons rendered flat red while the
         * sign-in button bulged; only the size differs now, via `size="card"`.
         */
        cardAction: [
          "btn-raised relative overflow-hidden",
          "border border-primary/80 bg-primary text-primary-foreground",
          "hover:bg-primary/95",
        ].join(" "),
      },
      // Heights come from the shared control scale so a button always lines up
      // with the input or select it sits next to.
      size: {
        default: `${CONTROL_HEIGHT.md} px-3 has-[>svg]:px-2.5`,
        sm: `${CONTROL_HEIGHT.sm} gap-1.5 px-2.5 has-[>svg]:px-2`,
        lg: `${CONTROL_HEIGHT.lg} px-4 text-sm has-[>svg]:px-3.5`,
        // Full-width card footer action: shorter than `sm` and stretched, so it
        // reads as part of the card rather than as a button placed on it.
        card: "h-8 w-full px-3 text-[0.8125rem] has-[>svg]:px-2.5",
        icon: CONTROL_SQUARE.md,
        "icon-sm": CONTROL_SQUARE.sm,
        "icon-lg": CONTROL_SQUARE.lg,
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      suppressHydrationWarning={true}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
