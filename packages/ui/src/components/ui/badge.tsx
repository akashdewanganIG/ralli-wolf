import * as React from "react";

import { Tag, type TagTone } from "@repo/ui/components/ui/tag";

/**
 * Compatibility shim over `Tag`.
 *
 * `Badge` predates `Tag` and is still called in ~55 places with its own
 * variant names. Those names map onto tones here so every one of them renders
 * the single `Tag` appearance — there is no longer a "solid" or "outline"
 * badge that could look like a different component.
 *
 * New code should use `Tag`, whose vocabulary names the state ("pending")
 * rather than the paint ("warning").
 */
const VARIANT_TONE: Record<string, TagTone> = {
  default: "neutral",
  secondary: "neutral",
  outline: "neutral",
  destructive: "danger",
  success: "active",
  warning: "pending",
  info: "progress",
};

export type BadgeVariant = keyof typeof VARIANT_TONE;

export interface BadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "onCopy"> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <Tag
      tone={VARIANT_TONE[variant] ?? "neutral"}
      className={className}
      {...props}
    />
  );
}

export { Badge };
