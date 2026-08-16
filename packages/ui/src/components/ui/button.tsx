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
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium outline-none transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-150 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default:
          "border border-primary bg-primary text-primary-foreground hover:border-primary/90 hover:bg-primary/90",
        destructive:
          "border border-destructive bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-input bg-surface text-foreground hover:border-border hover:bg-surface-subtle dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "border border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost:
          "border border-transparent hover:bg-secondary hover:text-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // Heights come from the shared control scale so a button always lines up
      // with the input or select it sits next to.
      size: {
        default: `${CONTROL_HEIGHT.md} px-4 has-[>svg]:px-3.5`,
        sm: `${CONTROL_HEIGHT.sm} gap-1.5 px-3 has-[>svg]:px-2.5`,
        lg: `${CONTROL_HEIGHT.lg} px-5 text-sm has-[>svg]:px-4`,
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
