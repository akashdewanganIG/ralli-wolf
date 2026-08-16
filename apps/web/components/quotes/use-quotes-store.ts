"use client";

import * as React from "react";
import { DEFAULT_DUMMY_QUOTES } from "./quote-dummy-data";
import type { Quote } from "./quote-types";

const STORAGE_KEY = "innocrm_dummy_quotes_v1";

function normalizeQuote(quote: Quote): Quote {
  const now = new Date().toISOString();
  return {
    ...quote,
    lineItemCount: Number.isFinite(quote.lineItemCount)
      ? quote.lineItemCount
      : Math.floor(Math.random() * 5) + 1,
    createdAt: quote.createdAt || now,
    lastModifiedBy: quote.lastModifiedBy || quote.createdBy || "Sales Rep",
    lastModifiedAt: quote.lastModifiedAt || quote.createdAt || now,
  };
}

function safeParse(raw: string | null): Quote[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return (parsed as Quote[]).map(normalizeQuote);
  } catch {
    return null;
  }
}

function loadInitial(): Quote[] {
  if (typeof window === "undefined") return DEFAULT_DUMMY_QUOTES;
  const fromStorage = safeParse(window.localStorage.getItem(STORAGE_KEY));
  if (fromStorage && fromStorage.length > 0) return fromStorage;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(DEFAULT_DUMMY_QUOTES)
  );
  return DEFAULT_DUMMY_QUOTES.map(normalizeQuote);
}

function persist(quotes: Quote[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
}

export function useQuotesStore() {
  const [quotes, setQuotes] = React.useState<Quote[]>([]);
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    setQuotes(loadInitial());
    setIsReady(true);
  }, []);

  const createQuote = React.useCallback((quote: Quote) => {
    setQuotes(prev => {
      const next = [normalizeQuote(quote), ...prev];
      persist(next);
      return next;
    });
  }, []);

  const byOpportunityId = React.useCallback(
    (opportunityId: string) =>
      quotes.filter(q => q.opportunityId === opportunityId),
    [quotes]
  );

  const getById = React.useCallback(
    (id: string) => quotes.find(q => q.id === id),
    [quotes]
  );

  return {
    quotes,
    isReady,
    createQuote,
    byOpportunityId,
    getById,
  };
}
