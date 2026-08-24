"use client";

import { useState } from "react";
import { KeyRound } from "@repo/ui/icons";
import { Badge } from "@repo/ui/components/ui/badge";
import { CardActionButton } from "@repo/ui/components/ui/card-action-button";
import { PageHeader } from "@repo/ui/components/ui/page-header";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { Panel, PanelSection } from "@repo/ui/components/ui/panel";

import { ChangePasswordModal } from "@/components/change-password-modal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import CurrencySettings from "@/components/currency-settings";
import { AuthenticationMethods } from "@/components/authentication-methods";
import DiscountThresholdSettings from "@/components/discount-threshold-settings";
import { useAuth } from "@/contexts/AuthContext";

function getInitials(firstName?: string | null, lastName?: string | null) {
  const initials = [firstName, lastName]
    .filter(Boolean)
    .map(part => part?.trim().charAt(0).toUpperCase())
    .join("");

  return initials || "RW";
}

function formatRole(role?: string) {
  if (!role) return "User";

  return role
    .toLowerCase()
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "Ralli Wolf user";

  return (
    <ProtectedRoute>
      {/* PageShell rather than a hand-rolled padded div: it is the container
          every other page opens with, and it owns the only horizontal padding
          on the page, so the heading and the panels share one left edge. */}
      <PageShell>
        <PageHeader
          title="Settings"
          description="Your sign-in security, plus settings that apply to everyone in this workspace."
        />

        {/* Yours first, then everyone's — the personal settings are the ones a
            signed-in user came here to change. */}
        <PanelSection
          id="settings-account-heading"
          title="Your account"
          description="Who this workspace knows you as."
        >
          <Panel
            title="Profile"
            description="Your name and email as other people see them. Ask an administrator to change these."
            action={
              <CardActionButton onClick={() => setShowChangePassword(true)}>
                <KeyRound className="size-4" />
                Change password
              </CardActionButton>
            }
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background"
              >
                {getInitials(user?.firstName, user?.lastName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {displayName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email || "No email available"}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {formatRole(user?.role)}
              </Badge>
            </div>
          </Panel>
        </PanelSection>

        {/* Security stands on its own: it is a list of methods with their own
            states and actions, not another field on the profile. */}
        <PanelSection
          id="settings-security-heading"
          title="Security"
          description="How you prove it is you when signing in."
        >
          <Panel
            title="Sign-in methods"
            description="How you log in. Keep at least two switched on so you are never locked out."
            bodyClassName="p-0"
          >
            <AuthenticationMethods />
          </Panel>
        </PanelSection>

        <PanelSection
          id="settings-workspace-heading"
          title="Workspace"
          description="Applies to everyone who works in this workspace."
          className="xl:grid-cols-2"
        >
          <Panel
            title="Currency and locale"
            description="The currency that every price and total is shown in."
          >
            <CurrencySettings />
          </Panel>

          <Panel
            title="Manager approval threshold"
            description="Any discount bigger than this needs a manager to approve it first."
          >
            <DiscountThresholdSettings />
          </Panel>
        </PanelSection>

        <ChangePasswordModal
          open={showChangePassword}
          onClose={() => setShowChangePassword(false)}
        />
      </PageShell>
    </ProtectedRoute>
  );
}
