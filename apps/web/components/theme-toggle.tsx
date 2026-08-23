"use client";

import * as React from "react";
import { Moon, Sun } from "@repo/ui/icons";
import { cn } from "@repo/ui/lib/utils";
import { useTheme, type Theme } from "./theme-provider";

const OPTIONS: Array<{
  value: Theme;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

/**
 * Two-way theme switch. There is no "follow the OS" option: the app ships dark
 * and stays wherever the user puts it, so the control only ever reports a
 * choice someone actually made.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // The stored preference is only known on the client; render the frame first
  // and fill in the selected state after hydration to avoid a mismatch.
  React.useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface-secondary p-0.5",
        className
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring/40",
              selected
                ? "bg-surface text-foreground shadow-xs"
                : "text-muted-foreground hover:bg-hover hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
