import { cn } from "@repo/ui/lib/utils";

/**
 * Stand-in for the customer logo until real brand artwork is supplied.
 * Sizing is left to the caller so each slot keeps the height it had before.
 */
export default function LogoPlaceholder({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Your logo here please"
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/40 px-3 text-xs font-medium whitespace-nowrap text-muted-foreground",
        className
      )}
    >
      Your logo here please
    </div>
  );
}
