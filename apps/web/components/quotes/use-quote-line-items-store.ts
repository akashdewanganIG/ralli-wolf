"use client";

import * as React from "react";
import type { QuoteLineItem } from "./quote-types";
import { DEFAULT_DUMMY_QUOTE_LINE_ITEMS } from "./quote-dummy-data";

const STORAGE_KEY = "innocrm_dummy_quote_line_items_v1";

function normalize(item: QuoteLineItem): QuoteLineItem {
  const now = new Date().toISOString();
  const listUnitPrice = Number(item.listUnitPrice || 0);
  const quantity = Number(item.quantity || 0);
  return {
    ...item,
    number: Number(item.number || 0),
    listUnitPrice,
    quantity,
    netPrice: listUnitPrice * quantity,
    createdAt: item.createdAt || now,
    lastModifiedBy: item.lastModifiedBy || item.createdBy || "Sales Rep",
    lastModifiedAt: item.lastModifiedAt || item.createdAt || now,
  };
}

function safeParse(raw: string | null): QuoteLineItem[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return (parsed as QuoteLineItem[]).map(normalize);
  } catch {
    return null;
  }
}

function loadInitial(): QuoteLineItem[] {
  if (typeof window === "undefined") return DEFAULT_DUMMY_QUOTE_LINE_ITEMS;
  const fromStorage = safeParse(window.localStorage.getItem(STORAGE_KEY));
  if (fromStorage) return fromStorage;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(DEFAULT_DUMMY_QUOTE_LINE_ITEMS)
  );
  return DEFAULT_DUMMY_QUOTE_LINE_ITEMS.map(normalize);
}

function persist(items: QuoteLineItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useQuoteLineItemsStore() {
  const [lineItems, setLineItems] = React.useState<QuoteLineItem[]>([]);
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    setLineItems(loadInitial());
    setIsReady(true);
  }, []);

  const byQuoteId = React.useCallback(
    (quoteId: string) =>
      lineItems
        .filter(li => li.quoteId === quoteId)
        .sort((a, b) => a.number - b.number),
    [lineItems]
  );

  const getById = React.useCallback(
    (lineItemId: string) => lineItems.find(li => li.id === lineItemId),
    [lineItems]
  );

  const createLineItem = React.useCallback((item: QuoteLineItem) => {
    setLineItems(prev => {
      const next = [normalize(item), ...prev];
      persist(next);
      return next;
    });
  }, []);

  const updateLineItem = React.useCallback(
    (lineItemId: string, patch: Partial<QuoteLineItem>) => {
      setLineItems(prev => {
        const next = prev.map(li => {
          if (li.id !== lineItemId) return li;
          return normalize({
            ...li,
            ...patch,
            id: li.id,
          });
        });
        persist(next);
        return next;
      });
    },
    []
  );

  return {
    lineItems,
    isReady,
    byQuoteId,
    getById,
    createLineItem,
    updateLineItem,
  };
}
