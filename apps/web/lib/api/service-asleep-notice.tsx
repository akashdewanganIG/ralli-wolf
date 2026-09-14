"use client";

import { Loader2Icon } from "@repo/ui/icons";
import { toast } from "../toast";
import { ensureApiReady, manualApiWakeUrl } from "./service-readiness";

/**
 * A request through the app's /api/* proxy is still an inbound request to the
 * hosted API, so it wakes a suspended Render service. Keep that work inside the
 * application and report progress instead of asking the user to visit the API.
 */
const NOTICE_ID = "api-service-asleep";
let notified = false;

function openManualWakeup(): void {
  window.open(manualApiWakeUrl(), "_blank", "noopener,noreferrer");
}

function showStartingNotice(): void {
  toast.custom(
    () => (
      <div className="w-full rounded-lg border border-border bg-popover px-3.5 py-3 text-popover-foreground shadow-[0_1px_2px_rgba(16,24,40,0.05),0_8px_20px_-8px_rgba(16,24,40,0.16)]">
        <div className="flex items-center gap-2">
          <p className="text-[0.8125rem] font-semibold leading-5 tracking-[-0.006em]">
            Starting the server
          </p>
          <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
        </div>
        <p className="mt-0.5 text-[0.75rem] leading-[1.4] text-foreground/70">
          The idle API is waking automatically. This can take about a minute.
        </p>
        <button
          type="button"
          onClick={openManualWakeup}
          className="mt-2.5 w-full rounded-md border border-foreground/15 bg-foreground/[0.06] px-3 py-2 text-[0.75rem] font-medium text-foreground transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          Start server manually
        </button>
      </div>
    ),
    { id: NOTICE_ID, duration: Infinity }
  );
}

/**
 * Gateway failures are only a hint that the API is suspended. The shared
 * readiness check confirms that state while also supplying the inbound request
 * that wakes it.
 */
export function notifyServiceAsleep(): void {
  if (typeof window === "undefined") return;
  if (notified) return;
  notified = true;

  showStartingNotice();

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
