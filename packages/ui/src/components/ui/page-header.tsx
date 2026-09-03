import * as React from "react";
import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import { InfoHint } from "@repo/ui/components/ui/info-hint";

export function PageHeader({
  title,
  description,
  subtitle,
  actions,
  breadcrumb,
  className,
  titleClassName,
  descriptionInline = false,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: Array<{ label: string; href?: string }>;
  className?: string;
  titleClassName?: string;

  descriptionInline?: boolean;
}) {
  const supportingText = description ?? subtitle;
  return (
    <header className={cn("space-y-1.5", className)}>
      {breadcrumb?.length ? (
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
        >
          {breadcrumb.map((crumb, index) => (
            <React.Fragment key={`${crumb.label}-${index}`}>
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
              {index < breadcrumb.length - 1 ? (
                <span aria-hidden="true">/</span>
              ) : null}
            </React.Fragment>
          ))}
        </nav>
      ) : null}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-1.5">
          <h1
            className={cn(
              "min-w-0 text-base font-semibold leading-6 tracking-tight text-foreground sm:text-lg sm:leading-7",
              titleClassName
            )}
          >
            {title}
          </h1>

          {supportingText ? (
            descriptionInline ? null : (
              <InfoHint label={supportingText} />
            )
          ) : null}
        </div>
        {actions ? (
          <div className="grid w-full min-w-0 shrink-0 grid-cols-1 items-center gap-2 sm:w-auto sm:grid-cols-none sm:flex sm:flex-wrap sm:justify-end [&>*]:min-w-0">
            {actions}
          </div>
        ) : null}
      </div>
      {supportingText && descriptionInline ? (
        <div className="max-w-3xl text-[0.8125rem] leading-5 text-muted-foreground">
          {supportingText}
        </div>
      ) : null}
    </header>
  );
}
