"use client";

import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Check, Search } from "@repo/ui/icons";
import { cn } from "@repo/ui/lib/utils";

import { useCurrency } from "@/contexts/currency-context";
import { currencySymbol, distinctCurrencySymbol } from "@/lib/utils/decimal";

export function CurrencyToggle({ className }: { className?: string }) {
  const { currency, symbol, options, updateCurrency } = useCurrency();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const list = React.useMemo(() => {
    const seen = new Map<
      string,
      { code: string; symbol?: string; name?: string }
    >();
    seen.set(currency, { code: currency, symbol });
    for (const option of options) {
      if (option?.code) seen.set(option.code, option);
    }
    return [...seen.values()];
  }, [options, currency, symbol]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      o =>
        o.code.toLowerCase().includes(q) ||
        (o.name ?? "").toLowerCase().includes(q)
    );
  }, [list, query]);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={next => {
        setOpen(next);

        if (!next) setQuery("");
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[0.8125rem] font-medium text-foreground outline-none transition-[background-color,border-color] duration-150 hover:border-border-strong hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring/30",
            className
          )}
          aria-label={`Display currency: ${currency}. Change it.`}
        >
          <span aria-hidden="true" className="text-muted-foreground">
            {currencySymbol(currency, symbol)}
          </span>
          {currency}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[min(17rem,calc(100vw-2rem))] p-1"
        align="end"
        sideOffset={6}
      >
        <p className="px-2.5 pb-1 pt-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Display currency
        </p>

        <div className="relative px-1 pb-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder="Search currency or code"
            aria-label="Search currencies"
            className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-2 text-[0.8125rem] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>

        <div className="max-h-[min(20rem,60svh)] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-2.5 py-6 text-center text-xs text-muted-foreground">
              No currency matches “{query}”.
            </p>
          ) : (
            filtered.map(option => {
              const selected = option.code === currency;
              return (
                <DropdownMenuItem
                  key={option.code}
                  onClick={() =>
                    void updateCurrency(option.code, option.symbol)
                  }
                  className="justify-between"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      dir="ltr"
                      className="w-9 shrink-0 text-center text-[0.75rem] tabular-nums text-muted-foreground [unicode-bidi:isolate]"
                    >
                      {distinctCurrencySymbol(option.code, option.symbol)}
                    </span>
                    <span className="truncate">
                      {option.name ?? option.code}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                    {option.code}
                    {selected ? (
                      <Check
                        aria-hidden="true"
                        className="size-3.5 text-primary"
                      />
                    ) : null}
                  </span>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
