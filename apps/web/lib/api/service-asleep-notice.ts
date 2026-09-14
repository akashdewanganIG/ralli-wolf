"use client";

import { toast } from "../toast";
import { ensureApiReady } from "./service-readiness";

/**
 * A request through the app's /api/* proxy is still an inbound request to the
 * hosted API, so it wakes a suspended Render service. Keep that work inside the
 * application and report progress instead of asking the user to visit the API.
 */
const NOTICE_ID = "api-service-asleep";
let notified = false;

/**
 * Gateway failures are only a hint that the API is suspended. The shared
 * readiness check confirms that state while also supplying the inbound request
 * that wakes it.
 */
export function notifyServiceAsleep(): void {
  if (typeof window === "undefined") return;
  if (notified) return;
  notified = true;

  toast.loading("Starting the server", {
    id: NOTICE_ID,
    description:
      "The API was idle. This page is waking it automatically; it can take about a minute on free hosting.",
    duration: Infinity,
  });

  void ensureApiReady()
    .then(() => {
      toast.success("The server is ready", {
        id: NOTICE_ID,
        description: "Please retry the action that was interrupted.",
        duration: 5_000,
      });
    })
    .catch(() => {
      toast.error("The server is taking longer than expected", {
        id: NOTICE_ID,
        description:
          "Wait a moment and try again. No separate API page is needed.",
        duration: 8_000,
      });
    })
    .finally(() => {
      notified = false;
    });
}
