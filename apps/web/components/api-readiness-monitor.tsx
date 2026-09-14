"use client";

import { useEffect } from "react";
import { ensureApiReady } from "@/lib/api/service-readiness";
import { notifyServiceAsleep } from "@/lib/api/service-asleep-notice";

const STARTUP_NOTICE_DELAY_MS = 750;

export function ApiReadinessMonitor() {
  useEffect(() => {
    let settled = false;
    const noticeTimer = window.setTimeout(() => {
      if (!settled) notifyServiceAsleep();
    }, STARTUP_NOTICE_DELAY_MS);

    void ensureApiReady().then(
      () => {
        settled = true;
        window.clearTimeout(noticeTimer);
      },
      () => {
        settled = true;
        window.clearTimeout(noticeTimer);
      }
    );

    return () => window.clearTimeout(noticeTimer);
  }, []);

  return null;
}
