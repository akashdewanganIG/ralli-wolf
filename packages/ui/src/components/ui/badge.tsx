import * as React from "react";

import { Tag, type TagTone } from "@repo/ui/components/ui/tag";

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
