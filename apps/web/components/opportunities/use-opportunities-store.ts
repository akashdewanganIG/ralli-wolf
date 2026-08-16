"use client";

import * as React from "react";
import type { Opportunity } from "./opportunity-types";
import { DEFAULT_DUMMY_OPPORTUNITIES } from "./opportunity-dummy-data";

const STORAGE_KEY = "innocrm_dummy_opportunities_v1";

function safeParse(raw: string | null): Opportunity[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as Opportunity[];
  } catch {
    return null;
  }
}

function loadInitial(): Opportunity[] {
  if (typeof window === "undefined") return DEFAULT_DUMMY_OPPORTUNITIES;
  const fromStorage = safeParse(window.localStorage.getItem(STORAGE_KEY));
  if (fromStorage && fromStorage.length > 0) return fromStorage;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(DEFAULT_DUMMY_OPPORTUNITIES)
  );
  return DEFAULT_DUMMY_OPPORTUNITIES;
}

function persist(opps: Opportunity[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(opps));
}

export function useOpportunitiesStore() {
  const [opportunities, setOpportunities] = React.useState<Opportunity[]>([]);
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    setOpportunities(loadInitial());
    setIsReady(true);
  }, []);

  const upsertOpportunity = React.useCallback((opportunity: Opportunity) => {
    setOpportunities(prev => {
      const next = prev.some(o => o.id === opportunity.id)
        ? prev.map(o => (o.id === opportunity.id ? opportunity : o))
        : [opportunity, ...prev];
      persist(next);
      return next;
    });
  }, []);

  const createOpportunity = React.useCallback((opportunity: Opportunity) => {
    setOpportunities(prev => {
      const next = [opportunity, ...prev];
      persist(next);
      return next;
    });
  }, []);

  const getById = React.useCallback(
    (id: string) => opportunities.find(o => o.id === id),
    [opportunities]
  );

  return {
    opportunities,
    isReady,
    createOpportunity,
    upsertOpportunity,
    getById,
  };
}
