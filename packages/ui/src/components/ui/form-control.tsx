import { cva, type VariantProps } from "class-variance-authority";

/**
 * Single source of truth for the size and shape of every form control.
 *
 * Input, Textarea, SelectTrigger, SearchInput, SelectField and SearchableSelect
 * all render the classes below, so a text field is exactly as tall as the select
 * sitting next to it on every screen. Buttons read their heights from
 * `CONTROL_HEIGHT` too, so a "Search" button lines up with the search box.
 *
 * Never hard-code `h-*`, `rounded-*`, `px-*` or `text-sm/base` on a control at a
 * call site — pass `size` instead. If a screen genuinely needs a new size, add it
 * here so every control gains it at once.
 */

/** The only heights a form control may have. */
export const CONTROL_HEIGHT = {
  sm: "h-9",
  md: "h-10",
  lg: "h-11",
} as const;

export type ControlSize = keyof typeof CONTROL_HEIGHT;

/** Matching square size, for icon-only buttons that sit in a row of controls. */
export const CONTROL_SQUARE = {
  sm: "size-9",
  md: "size-10",
  lg: "size-11",
} as const;

/** Border, surface, colour and disabled treatment shared by every control. */
export const controlSurfaceClass =
  "w-full min-w-0 rounded-lg border border-input bg-surface text-foreground outline-none transition-[background-color,border-color,box-shadow,color] duration-150 placeholder:text-muted-foreground/80 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 dark:bg-input/30";

/** Focus and invalid rings shared by every control. */
export const controlFocusClass =
  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40";

const controlBaseClass = `${controlSurfaceClass} ${controlFocusClass}`;

/** Fixed-height controls: inputs, select triggers, combobox triggers. */
export const controlVariants = cva(controlBaseClass, {
  variants: {
    size: {
      sm: `${CONTROL_HEIGHT.sm} px-2.5 text-sm`,
      md: `${CONTROL_HEIGHT.md} px-3 text-sm`,
      lg: `${CONTROL_HEIGHT.lg} px-3.5 text-base`,
    },
  },
  defaultVariants: {
    size: "md",
  },
});

/**
 * Auto-growing controls (textarea). Same surface and focus treatment, but the
 * height comes from `rows`/`min-h-*` rather than the fixed scale.
 */
export const controlAreaVariants = cva(
  `${controlBaseClass} resize-y leading-5`,
  {
    variants: {
      size: {
        sm: "px-2.5 py-2 text-sm",
        md: "px-3 py-2.5 text-sm",
        lg: "px-3.5 py-3 text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export type ControlVariantProps = VariantProps<typeof controlVariants>;
