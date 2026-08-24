"use client";

import * as React from "react";

import { cn } from "../../lib/utils";
import { useTabsOptional } from "./tabs";

export type CategorySwitcherItem<T extends string> = {
  value: T;
  label: React.ReactNode;
  /** Shown as a muted count beside the label — "Entries 12", never "Entries (12)". */
  count?: number;
};

type CategorySwitcherProps<T extends string> = {
  items: ReadonlyArray<CategorySwitcherItem<T>>;
  /** Omit both when inside <Tabs>; the switcher then drives the tab state. */
  value?: T;
  onValueChange?: (value: T) => void;
  /** Accessible name for the group, e.g. "Order sections". */
  label: string;
  className?: string;
};

/**
 * The one control for switching between categories on a page.
 *
 * Every section uses this — detail-page sections, list filters, dialog modes —
 * so a reader learns the shape once. It replaces three earlier components that
 * had drifted apart (a pill track, a bordered segmented control, and an
 * underlined tab bar), plus a handful of pages that hand-rolled the same thing
 * out of buttons.
 *
 * The selected item is a soft red tint with red text, matching how the sidebar
 * marks the current page: this is secondary navigation, and it should read as
 * the same idea one level down. Sizing follows the site's control scale — a
 * 32px track holding 28px items at 13px text — rather than the 40–44px tracks
 * and 18px labels it replaces.
 *
 * Inside a `<Tabs>` it wires itself to the tab state, so the common case needs
 * no value/onValueChange plumbing:
 *
 * ```tsx
 * <Tabs defaultValue="details">
 *   <CategorySwitcher label="Sections" items={[…]} />
 *   <TabsContents><TabsContent value="details">…</TabsContent></TabsContents>
 * </Tabs>
 * ```
 */
export function CategorySwitcher<T extends string>({
  items,
  value,
  onValueChange,
  label,
  className,
}: CategorySwitcherProps<T>) {
  const tabs = useTabsOptional();
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  // Controlled props win; otherwise fall back to the surrounding <Tabs>.
  const active = (value ?? (tabs?.activeValue as T | undefined)) as T | undefined;
  const select = React.useCallback(
    (next: T) => {
      if (onValueChange) onValueChange(next);
      else tabs?.handleValueChange(next);
    },
    [onValueChange, tabs]
  );

  const selectAt = (index: number) => {
    const item = items[index];
    if (!item) return;
    select(item.value);
    refs.current[index]?.focus();
  };

  // Wraps around at both ends.
  const move = (from: number, direction: 1 | -1) => {
    selectAt((from + direction + items.length) % items.length);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        // No fixed height: `overflow-x-auto` also makes the y-axis scrollable,
        // so a track shorter than its padding + items would overflow by a
        // couple of pixels and clip the focus ring. Letting the height follow
        // the content keeps the ring inside the padding.
        "inline-flex w-fit max-w-full shrink-0 items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-lg border border-border bg-surface-secondary p-0.5 align-middle",
        className
      )}
    >
      {items.map((item, index) => {
        const selected = item.value === active;
        return (
          <button
            key={item.value}
            ref={node => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            // Roving tabindex: the group is one tab stop, arrows move within it.
            tabIndex={selected ? 0 : -1}
            data-state={selected ? "active" : "inactive"}
            onClick={() => select(item.value)}
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
              "inline-flex h-7 min-w-max shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 text-[0.8125rem] font-medium outline-none transition-[background-color,color] duration-150 focus-visible:ring-2 focus-visible:ring-ring/30",
              // Weight stays constant across states. The sidebar can bold its
              // active item because it stacks vertically; here a weight change
              // re-measures the text and nudges every tab beside it.
              selected
                ? "bg-primary-surface text-primary-surface-foreground"
                : "text-muted-foreground hover:bg-hover hover:text-foreground"
            )}
          >
            <span className="whitespace-nowrap">{item.label}</span>
            {item.count !== undefined ? (
              <>
                {/*
                  A real space so the accessible name reads "Structure 3", not
                  "Structure3". A white-space-only flex item is not rendered, so
                  this costs nothing visually — the gap still does the spacing.
                */}
                {" "}
                <span
                  className={cn(
                    "tabular-nums",
                    selected ? "opacity-70" : "opacity-80"
                  )}
                >
                  {item.count}
                </span>
              </>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
