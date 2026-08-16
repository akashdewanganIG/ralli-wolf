"use client";

import * as React from "react";
import { cn } from "@repo/ui/lib/utils";

export type SegmentedControlItem<T extends string> = {
  value: T;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  items,
  label,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  items: ReadonlyArray<SegmentedControlItem<T>>;
  label: string;
  className?: string;
}) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const selectAt = (index: number) => {
    const item = items[index];
    if (!item || item.disabled) return;
    onValueChange(item.value);
    refs.current[index]?.focus();
  };

  const move = (from: number, direction: 1 | -1) => {
    for (let step = 1; step <= items.length; step += 1) {
      const index = (from + step * direction + items.length) % items.length;
      if (!items[index]?.disabled) {
        selectAt(index);
        return;
      }
    }
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "grid min-h-11 w-fit max-w-full auto-cols-fr grid-flow-col gap-1 overflow-x-auto rounded-xl border border-border/70 bg-secondary p-1",
        className
      )}
    >
      {items.map((item, index) => {
        const selected = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            ref={node => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            onKeyDown={event => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                move(index, 1);
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                move(index, -1);
              } else if (event.key === "Home") {
                event.preventDefault();
                selectAt(0);
              } else if (event.key === "End") {
                event.preventDefault();
                selectAt(items.length - 1);
              }
            }}
            className={cn(
              "inline-flex h-9 min-w-max items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50",
              selected
                ? "bg-surface text-foreground shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
            )}
          >
            {Icon ? (
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  selected ? "text-primary" : "text-muted-foreground"
                )}
              />
            ) : null}
            <span className="whitespace-nowrap">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
