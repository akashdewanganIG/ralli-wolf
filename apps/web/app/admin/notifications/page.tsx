"use client";

import { PageHeader } from "@repo/ui/components/ui/page-header";
import { PageShell } from "@repo/ui/components/ui/page-shell";

import { NotificationPreferences } from "@/components/notification-preferences";
import { ProtectedRoute } from "@/components/ProtectedRoute";

/**
 * Per-user notification settings.
 *
 * Not behind a role guard: these are the signed-in user's own preferences, so
 * everyone with an account can reach them. It sits under Administration
 * because that is where the rest of the account-level settings live.
 */
export default function NotificationSettingsPage() {
  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title="Notifications"
          description="Pick which alerts you want, and whether they also arrive by email."
        />
        <NotificationPreferences />
      </PageShell>
    </ProtectedRoute>
  );
}
