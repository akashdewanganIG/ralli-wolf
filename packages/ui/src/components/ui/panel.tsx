import * as React from "react";

import { InfoHint } from "@repo/ui/components/ui/info-hint";
import { cn } from "@repo/ui/lib/utils";

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: React.ReactNode;

  description?: React.ReactNode;

  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;

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
