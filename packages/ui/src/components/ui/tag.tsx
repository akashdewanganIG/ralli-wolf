import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { X } from "@repo/ui/icons";
import { cn } from "@repo/ui/lib/utils";

/**
 * The one small label in this application.
 *
 * Statuses, roles, categories, counts, severities and filter chips are the same
 * object — a short word about a record — so they get one component and one
 * appearance. Everything about the shape is fixed and not a prop: the radius,
 * the height, the padding, the type size, the border weight. A caller chooses
 * *meaning*, never *looks*.
 *
 * That is deliberate and was arrived at the hard way. When shape, emphasis and
 * size were configurable, the same concept ended up drawn differently in
 * different modules — an admin role was a red chip in the user table and a
 * grey outline in the account menu, and Lead Management shipped its own
 * uppercase palette that bypassed the component entirely.
 */

/** Words that must not be sentence-cased into nonsense. */
const ACRONYMS = new Set([
  "QC",
  "BOM",
  "GRN",
  "PO",
  "PR",
  "SKU",
  "UOM",
  "FEFO",
  "FIFO",
  "WMS",
  "CRM",
  "SMS",
  "OTP",
  "ID",
  "API",
  "GST",
  "HSN",
  "MRP",
  "SLA",
  "KPI",
  "N/A",
  "NA",
]);

/**
 * `ADMIN` → `Admin`, `IN_PROGRESS` → `In progress`, `Landing Page` →
 * `Landing page`.
 *
 * Applied by the component rather than asked of each caller, because asking is
 * exactly what produced the inconsistency: some sites passed a humanised
 * label, others passed the raw enum, and a table ended up mixing `QUALIFIED`
 * with `In progress`. Doing it here means a tag reads the same wherever the
 * string came from.
 *
 * A caller that genuinely needs literal text — a product code, a person's
 * name — passes an element instead of a string and this never runs.
 */
function toSentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  // Leave anything that is not a word alone: counts, "12%", "3 of 5".
  if (!/[a-zA-Z]/.test(trimmed)) return trimmed;

  return trimmed
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word, index) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      // A capital *inside* a word is deliberate — brand names like WhatsApp,
      // or product names like eCommerce. Lower-casing those is a worse error
      // than leaving a stray capital, so they pass through untouched.
      if (/[a-z][A-Z]/.test(word)) return word;
      const lower = word.toLowerCase();
      return index === 0
        ? lower.charAt(0).toUpperCase() + lower.slice(1)
        : lower;
    })
    .join(" ");
}

const tagVariants = cva(
  [
    // Fixed geometry. Curved, not a pill: at this height a full pill reads as
    // a dismissible chip, which is wrong for a status you cannot act on.
    "inline-flex max-w-full items-center gap-1 rounded-md border align-middle",
    "min-h-5 px-1.5 py-0.5 text-[0.6875rem] font-medium leading-none",
    "whitespace-nowrap transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
    "[&>svg]:size-3 [&>svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      /**
       * What the tag means. Five states, named for the state rather than the
       * colour so a caller cannot ask for "the green one" and drift.
       */
      tone: {
        neutral: "border-border bg-secondary text-secondary-foreground",
        active: "border-success/20 bg-success-surface text-success-foreground",
        progress: "border-info/20 bg-info-surface text-info-foreground",
        pending: "border-warning/20 bg-warning-surface text-warning-foreground",
        danger: "border-error/20 bg-error-surface text-error-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

const TONE_DOT = {
  neutral: "bg-muted-foreground",
  active: "bg-success",
  progress: "bg-info",
  pending: "bg-warning",
  danger: "bg-error",
} as const;

export type TagTone = keyof typeof TONE_DOT;

export interface TagProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "onCopy">,
    VariantProps<typeof tagVariants> {
  /** Leading status dot, for a column scanned rather than read. */
  dot?: boolean;
  /** Makes the tag removable — the filter-chip case. */
  onRemove?: () => void;
  /** Accessible name for the remove control. */
  removeLabel?: string;
}

export function Tag({
  className,
  tone = "neutral",
  dot = false,
  onRemove,
  removeLabel,
  children,
  ...props
}: TagProps) {
  const label =
    typeof children === "string" ? toSentenceCase(children) : children;

  return (
    <span className={cn(tagVariants({ tone }), className)} {...props}>
      {dot ? (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            TONE_DOT[(tone ?? "neutral") as TagTone]
          )}
        />
      ) : null}
      <span className="min-w-0 truncate">{label}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? "Remove"}
          // Inherits the tag's tone; only the hover surface is its own.
          className="-mr-0.5 ml-0.5 inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm outline-none transition-colors duration-150 hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <X aria-hidden="true" className="size-2.5" />
        </button>
      ) : null}
    </span>
  );
}

export { tagVariants, toSentenceCase };
