"use client";

import { config } from "../config";
import { toast } from "../toast";

/**
 * Free hosting suspends the API when it is idle. Waking it needs a request that
 * reaches the API host itself — requests through this app's /api/* proxy are
 * answered by the host's edge while it is asleep, so they cannot do the waking.
 *
 * Rather than leave the user staring at failures, tell them plainly what has
 * happened and hand them a button that opens the API in a new tab, which is the
 * request that starts it. Then watch for it coming back and say so.
 */
const NOTICE_ID = "api-service-asleep";
const HEALTH_POLL_MS = 4_000;
const HEALTH_TIMEOUT_MS = 8_000;
const WATCH_BUDGET_MS = 3 * 60_000;

// Two separate concerns: `notified` stops duplicate toasts while one stands,
// `watching` keeps the recovery poll alive. They must not be one flag — Sonner
// dismisses a toast when its action is clicked, and folding them together would
// stop the watcher for the one user who actually pressed the button.
let notified = false;
let watching = false;
let confirming = false;

function apiOrigin(): string {
  return (process.env.NEXT_PUBLIC_API_ORIGIN || "").replace(/\/+$/, "");
}

async function apiIsUp(): Promise<boolean> {
  // Bounded so a request the host holds open through a cold start cannot stall
  // this indefinitely. An API that cannot answer within the timeout is not
  // usable yet, which is the same thing as down from the caller's side.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    // Deliberately a bare fetch, not the API client: this must not inherit the
    // client's wake-retry, or each poll would block for the whole retry budget.
    const response = await fetch(`${config.apiUrl}/api/health`, {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function watchForRecovery(): Promise<void> {
  if (watching) return;
  watching = true;
  const deadline = Date.now() + WATCH_BUDGET_MS;
  try {
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, HEALTH_POLL_MS));
      if (await apiIsUp()) {
        notified = false;
        toast.success("The server is up", {
          id: NOTICE_ID,
          description: "You can carry on where you left off.",
          duration: 5_000,
        });
        return;
      }
    }
    // Budget spent without recovery: drop the guard so a later failure can
    // raise the notice again rather than the app going quiet forever.
    notified = false;
  } finally {
    watching = false;
  }
}

/**
 * A failed request is only a *hint* that the API is down — a gateway error can
 * equally come from a blip in front of a perfectly healthy API. Confirm against
 * the health endpoint first so this never tells someone to start a server that
 * is already running.
 */
export function notifyServiceAsleep(): void {
  if (typeof window === "undefined") return;
  if (notified || confirming) return;

  const origin = apiOrigin();
  // Without a reachable origin there is no button worth offering, and a toast
  // that only states the problem would just be noise on top of the failure.
  if (!origin) return;

  confirming = true;
  void (async () => {
    try {
      if (await apiIsUp()) return;
      showNotice(origin);
    } finally {
      confirming = false;
    }
  })();
}

function showNotice(origin: string): void {
  if (notified) return;
  notified = true;
  toast.error("The server needs to be started", {
    id: NOTICE_ID,
    description:
      "The API is asleep because it was idle. Click Start server — it opens in a new tab and wakes it. Come back here once it loads.",
    duration: Infinity,
    action: {
      label: "Start server",
      onClick: () => {
        window.open(origin, "_blank", "noopener,noreferrer");
      },
    },
    onDismiss: () => {
      // Let a later failure re-raise it; the watcher keeps running so recovery
      // is still announced even after the user waves this away.
      notified = false;
    },
  });

  void watchForRecovery();
}
