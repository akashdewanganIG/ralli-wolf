"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Share2 } from "@repo/ui/icons";
import { cn } from "@repo/ui/lib/utils";

/**
 * Sits immediately to the left of the help assistant toggle and shares its
 * geometry — same height, radius, shadow and hover lift — in a surface tone
 * so the two pills do not compete. Navigates rather than opening a panel.
 */
export function ArchitectureTrigger() {
  const pathname = usePathname();
  const isActive = pathname === "/architecture";

  return (
    <Link
      href="/architecture"
      aria-label="Architecture and user flow map"
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group inline-flex h-12 shrink-0 items-center gap-2 rounded-full border outline-none ring-4",
        "shadow-[0_10px_24px_-8px_rgb(0_0_0/0.2)] transition-[background-color,box-shadow,transform,border-color] duration-150",
        "hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-8px_rgb(0_0_0/0.28)] active:translate-y-0 active:scale-95",
        "focus-visible:ring-ring/40",
        "pl-3.5 pr-4 max-sm:w-12 max-sm:justify-center max-sm:px-0",
        isActive
          ? "border-border-strong bg-surface-elevated text-foreground ring-border/20"
          : "border-border bg-surface text-foreground ring-border/10 hover:border-border-strong hover:bg-surface-elevated"
      )}
    >
      <Share2 className="size-5 shrink-0" />
      <span className="text-[0.8125rem] font-semibold max-sm:hidden">
        Architecture
      </span>
    </Link>
  );
}
