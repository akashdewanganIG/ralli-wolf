"use client";

import * as React from "react";
import { Desktop, Moon, Sun } from "@repo/ui/icons";
import { cn } from "@repo/ui/lib/utils";
import { useTheme, type Theme } from "./theme-provider";

const OPTIONS: Array<{
  value: Theme;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: "system", label: "System", Icon: Desktop },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

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
                ? "bg-primary-surface text-primary-surface-foreground"
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
