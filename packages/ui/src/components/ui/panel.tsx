import * as React from "react";

import { InfoHint } from "@repo/ui/components/ui/info-hint";
import { cn } from "@repo/ui/lib/utils";

/**
 * The bordered card every page builds its content out of.
 *
 * This started life inside the dashboard, which meant any other page wanting
 * the same object had to re-describe it — and settings, which did exactly that,
 * drifted: two-line headers, tinted header bands, an icon chip per card, and
 * five different paddings. Declaring it once is what makes "consistent with the
 * dashboard" a fact rather than an intention.
 *
 * The header is deliberately a single row. Descriptions explain what a panel is,
 * which matters the first time and is noise every time after, so they fold into
 * the info hint rather than taking a second line on every card forever.
 *
 * `action` is pinned to the foot behind its own rule, so a column of panels has
 * a straight bottom edge no matter how uneven their content is.
 */
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: React.ReactNode;
  /** Folded into the info hint beside the title. */
  description?: React.ReactNode;
  /** Full-width action rendered at the foot of the panel. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** For content that supplies its own padding, e.g. a full-bleed list. */
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm shadow-foreground/[0.025]",
        className
      )}
    >
      <header className="flex items-center gap-1.5 border-b border-border p-3">
        <h2 className="min-w-0 truncate text-sm font-semibold leading-5 text-foreground">
          {title}
        </h2>
        <InfoHint label={description} />
      </header>
      <div className={cn("flex min-w-0 flex-1 flex-col p-3", bodyClassName)}>
        {children}
      </div>
      {action ? (
        <div className="flex flex-col border-t border-border p-3 pt-2.5">
          {action}
        </div>
      ) : null}
    </section>
  );
}

/**
 * A titled run of panels.
 *
 * The heading is the only place a section explains itself, which is what keeps
 * the panels underneath free of their own preambles.
 */
export function PanelSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className="space-y-3" aria-labelledby={id}>
      <div>
        <h2 id={id} className="text-sm font-semibold text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className={cn("grid items-stretch gap-3", className)}>
        {children}
      </div>
    </section>
  );
}
