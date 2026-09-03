"use client";

import { PageHeader } from "@repo/ui/components/ui/page-header";
import { PageShell } from "@repo/ui/components/ui/page-shell";

import { NotificationPreferences } from "@/components/notification-preferences";
import { ProtectedRoute } from "@/components/protected-route";

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
