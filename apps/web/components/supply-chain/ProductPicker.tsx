"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import {
  CONTROL_HEIGHT,
  controlSurfaceClass,
} from "@repo/ui/components/ui/form-control";
import { Input } from "@repo/ui/components/ui/input";
import { cn } from "@repo/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { productService } from "@/lib/api/services";

export interface PickedProduct {
  id: number;
  code: string;
  name: string;
}

type ProductSearchResult = PickedProduct;

/**
 * Type-ahead product picker backed by the existing product search endpoint,
 * so supply-chain screens select from the same catalogue that sales uses
 * rather than a parallel item list.
 */
export function ProductPicker({
  value,
  onChange,
  placeholder = "Search by item code or name…",
  disabled = false,
  autoFocus = false,
}: {
  value: PickedProduct | null;
  onChange: (product: PickedProduct | null) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Debounce so a fast typist does not fire a request per keystroke.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["product-search", debounced],
    queryFn: () => productService.searchProducts(debounced),
    enabled: debounced.length >= 2,
    staleTime: 60 * 1000,
  });

  const results = useMemo<ProductSearchResult[]>(
    () =>
      Array.isArray(data?.data) ? (data.data as ProductSearchResult[]) : [],
    [data]
  );

  useEffect(() => {
    setActiveIndex(results.length > 0 ? 0 : -1);
  }, [results]);

  const selectProduct = (product: ProductSearchResult) => {
    onChange({ id: product.id, code: product.code, name: product.name });
    setOpen(false);
    setTerm("");
    setActiveIndex(-1);
  };

  // The filled state stands in for the input it replaces, so it borrows the
  // same surface and height rather than re-deriving them.
  if (value) {
    return (
      <div
        className={cn(
          controlSurfaceClass,
          CONTROL_HEIGHT.md,
          "flex items-center gap-2 bg-surface-subtle px-3 text-sm"
        )}
      >
        <span className="font-mono text-xs text-primary">{value.code}</span>
        <span className="min-w-0 flex-1 truncate">{value.name}</span>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(null);
              setTerm("");
            }}
            className="-mr-1.5 px-2 text-xs text-muted-foreground"
          >
            Change
          </Button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        placeholder={placeholder}
        value={term}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={event => {
          setTerm(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={event => {
          if (event.key === "ArrowDown" && results.length > 0) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex(index => Math.min(results.length - 1, index + 1));
          } else if (event.key === "ArrowUp" && results.length > 0) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex(index => Math.max(0, index - 1));
          } else if (
            event.key === "Enter" &&
            open &&
            activeIndex >= 0 &&
            results[activeIndex]
          ) {
            event.preventDefault();
            selectProduct(results[activeIndex]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        role="combobox"
        aria-label={placeholder}
        aria-autocomplete="list"
        aria-expanded={open && term.trim().length >= 2}
        aria-controls={listboxId}
        aria-activedescendant={
          open && activeIndex >= 0
            ? `${listboxId}-option-${activeIndex}`
            : undefined
        }
      />
      {open && term.trim().length >= 2 && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Product search results"
          className="absolute z-20 mt-1 max-h-64 w-full overscroll-contain overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg shadow-foreground/5"
        >
          {isFetching && (
            <p
              role="status"
              className="px-3 py-2 text-sm text-muted-foreground"
            >
              Searching…
            </p>
          )}
          {!isFetching && results.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No item matches “{term}”.
            </p>
          )}
          {results.map((product, index) => (
            <button
              key={product.id}
              id={`${listboxId}-option-${index}`}
              type="button"
              role="option"
              aria-selected={activeIndex === index}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectProduct(product)}
              className={`flex min-h-10 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm outline-none transition-colors ${
                activeIndex === index
                  ? "bg-secondary text-foreground"
                  : "hover:bg-surface-subtle"
              }`}
            >
              <span className="font-mono text-xs text-primary">
                {product.code}
              </span>
              <span className="min-w-0 flex-1 truncate">{product.name}</span>
            </button>
          ))}
        </div>
      )}
      {open && term.trim().length > 0 && term.trim().length < 2 && (
        <p className="absolute z-20 mt-1 w-full rounded-md border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-lg">
          Type at least two characters to search.
        </p>
      )}
    </div>
  );
}
