"use client";

import { useEffect, useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import type {
  StatusLevel,
  SystemStatusGroup,
} from "@repo/ui/components/ui/header/system-status-dropdown";

import { useHealth } from "./useWebhook";

/**
 * Whether the browser itself has a connection.
 *
 * Read through state rather than straight off `navigator` so the value tracks
 * the online/offline events instead of freezing at whatever it was on mount.
 * It starts optimistic because `navigator` does not exist during SSR, and a
 * first paint that claims "offline" and then corrects itself is worse than one
 * that is briefly optimistic.
 */
function useBrowserOnline() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}

function formatClock(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Everything the status menu shows, assembled from state the app already keeps.
 *
 * Nothing here is invented: connectivity comes from the browser, API and
 * database state from the existing `/health` endpoint, and synchronisation from
 * the React Query cache that every screen already writes to. A service appears
 * as "not synchronised" because its query actually errored, not because a list
 * somewhere says it might.
 */
export function useSystemStatus(): {
  groups: SystemStatusGroup[];
  summaryLabel?: string;
} {
  const browserOnline = useBrowserOnline();
  const { data: health, isLoading, isError, dataUpdatedAt } = useHealth();
  const inFlight = useIsFetching();
  const queryClient = useQueryClient();

  // The cache is mutable and not a React store; reading it during render is
  // fine because every value used here also drives a re-render through
  // `useIsFetching` or the health query above.
  const queries = queryClient.getQueryCache().getAll();
  const failed = queries.filter(query => query.state.status === "error");
  const succeeded = queries.filter(query => query.state.status === "success");
  const lastSuccess = succeeded.reduce(
    (latest, query) => Math.max(latest, query.state.dataUpdatedAt),
    0
  );

  const apiLevel: StatusLevel = isLoading
    ? "pending"
    : isError || !health
      ? "offline"
      : health.status === "ok"
        ? "healthy"
        : "error";

  const databaseLevel: StatusLevel = isLoading
    ? "pending"
    : !health
      ? "unknown"
      : health.database === "connected"
        ? "healthy"
        : "error";

  const syncLevel: StatusLevel = failed.length
    ? "warning"
    : inFlight > 0
      ? "pending"
      : lastSuccess
        ? "healthy"
        : "unknown";

  const groups: SystemStatusGroup[] = [
    {
      id: "connectivity",
      label: "Connectivity",
      entries: [
        {
          id: "browser",
          label: "Network",
          level: browserOnline ? "healthy" : "offline",
          detail: browserOnline ? "Online" : "Offline",
          tooltip: browserOnline
            ? "This browser reports an active network connection."
            : "This browser reports no network connection. Requests will fail until it returns.",
        },
        {
          id: "api",
          label: "API",
          level: apiLevel,
          detail:
            apiLevel === "pending"
              ? "Checking"
              : apiLevel === "healthy"
                ? "Reachable"
                : "Unreachable",
          tooltip: dataUpdatedAt
            ? `Health checked at ${formatClock(dataUpdatedAt)}. Re-checked every 30 seconds.`
            : "Waiting for the first health check.",
        },
        {
          id: "database",
          label: "Database",
          level: databaseLevel,
          detail:
            databaseLevel === "pending"
              ? "Checking"
              : databaseLevel === "healthy"
                ? "Connected"
                : databaseLevel === "unknown"
                  ? "Unknown"
                  : "Disconnected",
          tooltip:
            databaseLevel === "healthy"
              ? "The API completed a test query against the database."
              : "The API could not complete a test query against the database.",
        },
      ],
    },
    {
      id: "sync",
      label: "Synchronisation",
      entries: [
        {
          id: "state",
          label: "Data sync",
          level: syncLevel,
          detail:
            syncLevel === "pending"
              ? `${inFlight} in flight`
              : syncLevel === "warning"
                ? `${failed.length} failed`
                : syncLevel === "healthy"
                  ? "Up to date"
                  : "Not started",
          tooltip:
            syncLevel === "warning"
              ? "One or more requests failed. Reload the affected screen or use its refresh action."
              : "Screens refetch on their own schedule; this reflects every request the app has in flight.",
        },
        {
          id: "last",
          label: "Last update",
          level: lastSuccess ? "healthy" : "unknown",
          detail: lastSuccess ? formatClock(lastSuccess) : "—",
          tooltip: lastSuccess
            ? `Most recent successful response: ${new Date(lastSuccess).toLocaleString()}.`
            : "No successful response recorded yet in this session.",
        },
        {
          id: "loaded",
          label: "Services synced",
          level: succeeded.length ? "healthy" : "unknown",
          detail: `${succeeded.length}`,
          tooltip:
            "Number of data sources that have returned successfully in this session.",
        },
        ...(failed.length
          ? [
              {
                id: "failed",
                label: "Services failing",
                level: "error" as StatusLevel,
                detail: `${failed.length}`,
                tooltip:
                  "Data sources whose most recent request errored. They retry when their screen refetches.",
              },
            ]
          : []),
      ],
    },
  ];

  const summaryLabel = isLoading ? "Checking…" : undefined;

  return { groups, summaryLabel };
}
