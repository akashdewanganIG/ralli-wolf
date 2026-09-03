"use client";

import * as React from "react";
import Link from "next/link";

import type { IconComponent } from "@repo/ui/icons";
import { InfoHint } from "@repo/ui/components/ui/info-hint";
import { cn } from "@repo/ui/lib/utils";

export type MetricTone =
  | "neutral"
  | "positive"
  | "critical"
  | "warning"
  | "info";

/** Ordinary cards stay plain; only a card carrying a state gets the wash. */
const TONE_TINT: Record<MetricTone, string> = {
  neutral: "",
  positive: "metric-tint metric-tint-positive",
  critical: "metric-tint metric-tint-critical",
  warning: "metric-tint metric-tint-warning",
  info: "metric-tint metric-tint-info",
};

const TONE_ICON: Record<MetricTone, string> = {
  neutral: "bg-secondary text-muted-foreground",
  positive: "bg-success-surface text-success-foreground",
  critical: "bg-error-surface text-error-foreground",
  warning: "bg-error-surface text-error-foreground",
  info: "bg-info-surface text-info-foreground",
};

const TONE_HINT: Record<MetricTone, string> = {
  neutral: "text-muted-foreground",
  positive: "text-success-foreground",
  critical: "text-error-foreground",
  warning: "text-error-foreground",
  info: "text-info-foreground",
};

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;

  hint?: React.ReactNode;

  description?: React.ReactNode;
  tone?: MetricTone;
  icon?: IconComponent;
  href?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  hint,
  description,
  tone = "neutral",
  icon: Icon,
  href,
  className,
}: MetricCardProps) {
  const interactive = Boolean(href);

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="min-w-0 truncate text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {label}
          </p>
          {description ? <InfoHint label={description} /> : null}
        </div>
        {Icon ? (
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md",
              TONE_ICON[tone]
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
          </span>
        ) : null}
      </div>

      <p
        className="mt-2.5 truncate text-2xl font-semibold leading-none tracking-tight tabular-nums text-foreground"
        title={
          typeof value === "string" || typeof value === "number"
            ? String(value)
            : undefined
        }
      >
        {value}
      </p>

      {hint ? (
        <p
          className={cn(
            "mt-1.5 text-[0.6875rem] font-medium leading-4",
            TONE_HINT[tone]
          )}
        >
          {hint}
        </p>
      ) : null}
    </>
  );

  const shell = cn(
    TONE_TINT[tone],
    "flex min-w-0 flex-col rounded-xl border border-border bg-card p-3.5 shadow-sm shadow-foreground/[0.02]",
    "transition-[background-color,border-color,box-shadow] duration-150",
    interactive &&
      "outline-none hover:border-border-strong hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/30",
    className
  );

  if (href) {
    return (
      <Link href={href} className={shell}>
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}
