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
            ? "Your device is connected to the internet."
            : "Your device has lost its internet connection. Nothing will load until it comes back.",
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
            ? `Last checked at ${formatClock(dataUpdatedAt)}. The app checks again every 30 seconds.`
            : "Still checking whether the server can be reached.",
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
              ? "The server can reach the database where your information is kept."
              : "The server cannot reach the database, so your information may not load.",
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
              ? "Something did not load. Refresh the page to try again."
              : "Whether the app is still loading anything from the server right now.",
        },
        {
          id: "last",
          label: "Last update",
          level: lastSuccess ? "healthy" : "unknown",
          detail: lastSuccess ? formatClock(lastSuccess) : "—",
          tooltip: lastSuccess
            ? `The app last loaded data successfully at ${new Date(lastSuccess).toLocaleString()}.`
            : "Nothing has loaded from the server yet.",
        },
        {
          id: "loaded",
          label: "Services synced",
          level: succeeded.length ? "healthy" : "unknown",
          detail: `${succeeded.length}`,
          tooltip:
            "How many parts of this page have loaded their information successfully.",
        },
        ...(failed.length
          ? [
              {
                id: "failed",
                label: "Services failing",
                level: "error" as StatusLevel,
                detail: `${failed.length}`,
                tooltip:
                  "Parts of this page that failed to load. They try again when you refresh.",
              },
            ]
          : []),
      ],
    },
  ];

  const summaryLabel = isLoading ? "Checking…" : undefined;

  return { groups, summaryLabel };
}
