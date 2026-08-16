"use client";

import * as React from "react";
import type { Approval } from "./approval-types";
import { DEFAULT_APPROVALS } from "./approval-dummy-data";

const STORAGE_KEY = "innocrm_dummy_approvals_v1";

function safeParse(raw: string | null): Approval[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as Approval[];
  } catch {
    return null;
  }
}

function loadInitial(): Approval[] {
  if (typeof window === "undefined") return DEFAULT_APPROVALS;
  const fromStorage = safeParse(window.localStorage.getItem(STORAGE_KEY));
  if (fromStorage && fromStorage.length > 0) return fromStorage;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_APPROVALS));
  return DEFAULT_APPROVALS;
}

function persist(items: Approval[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useApprovalsStore() {
  const [approvals, setApprovals] = React.useState<Approval[]>([]);
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    setApprovals(loadInitial());
    setIsReady(true);
  }, []);

  const createApproval = React.useCallback((approval: Approval) => {
    setApprovals(prev => {
      const next = [approval, ...prev];
      persist(next);
      return next;
    });
  }, []);

  const updateApproval = React.useCallback(
    (id: string, patch: Partial<Approval>) => {
      setApprovals(prev => {
        const next = prev.map(a => (a.id === id ? { ...a, ...patch } : a));
        persist(next);
        return next;
      });
    },
    []
  );

  const getById = React.useCallback(
    (id: string) => approvals.find(a => a.id === id),
    [approvals]
  );

  const getMyApprovals = React.useCallback(
    (assigneeId: string) => approvals.filter(a => a.assigneeId === assigneeId),
    [approvals]
  );

  const getAllApprovals = React.useCallback(() => approvals, [approvals]);

  return {
    approvals,
    isReady,
    createApproval,
    updateApproval,
    getById,
    getMyApprovals,
    getAllApprovals,
  };
}
