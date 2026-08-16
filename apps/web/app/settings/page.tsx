"use client";

import { useState } from "react";
import {
  BadgePercent,
  CircleDollarSign,
  KeyRound,
  LockKeyhole,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";

import { ChangePasswordModal } from "@/components/change-password-modal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import CurrencySettings from "@/components/currency-settings";
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
      <div className="app-page space-y-6 pb-10 sm:space-y-8">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-7 sm:py-7">
          <div className="absolute -right-12 -top-16 size-44 rounded-full bg-primary/6 blur-2xl" />
          <div className="relative flex max-w-3xl items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
              <Settings2 className="size-5" />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Workspace preferences
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Settings
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Manage organisation-wide sales preferences and keep your account
                secure.
              </p>
            </div>
          </div>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <Card className="overflow-hidden shadow-sm shadow-foreground/[0.02]">
              <CardHeader className="border-b border-border bg-surface-subtle/70 px-5 pb-4 pt-5 sm:px-6">
                <div className="flex items-start gap-3.5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/8 text-primary">
                    <CircleDollarSign className="size-5" />
                  </div>
                  <div>
                    <CardTitle>Currency and locale</CardTitle>
                    <CardDescription className="mt-1">
                      Choose the currency used for monetary values throughout
                      the workspace.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
                <CurrencySettings />
              </CardContent>
            </Card>

            <Card className="overflow-hidden shadow-sm shadow-foreground/[0.02]">
              <CardHeader className="border-b border-border bg-surface-subtle/70 px-5 pb-4 pt-5 sm:px-6">
                <div className="flex items-start gap-3.5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/8 text-primary">
                    <BadgePercent className="size-5" />
                  </div>
                  <div>
                    <CardTitle>Sales controls</CardTitle>
                    <CardDescription className="mt-1">
                      Set approval guardrails for the opportunities workflow.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
                <DiscountThresholdSettings />
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6">
            <Card className="overflow-hidden shadow-sm shadow-foreground/[0.02]">
              <CardHeader className="px-5 pb-4 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>Your account</CardTitle>
                    <CardDescription className="mt-1">
                      Profile and sign-in security
                    </CardDescription>
                  </div>
                  <ShieldCheck
                    className="size-5 text-success"
                    aria-hidden="true"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-5 px-5 pb-5">
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                    {getInitials(user?.firstName, user?.lastName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">
                      {displayName}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {user?.email || "No email available"}
                    </p>
                  </div>
                </div>

                <Badge variant="secondary">{formatRole(user?.role)}</Badge>

                <Separator />

                <div className="rounded-xl border border-border bg-surface-subtle p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-muted-foreground shadow-sm ring-1 ring-border">
                      <LockKeyhole className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        Password
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Use a strong, unique password to protect your account.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => setShowChangePassword(true)}
                  >
                    <KeyRound className="size-4" />
                    Change password
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-xl border border-border bg-surface-subtle px-4 py-3 text-xs leading-5 text-muted-foreground">
              Organisation settings affect all users who work in this workspace.
            </div>
          </aside>
        </div>

        <ChangePasswordModal
          open={showChangePassword}
          onClose={() => setShowChangePassword(false)}
        />
      </div>
    </ProtectedRoute>
  );
}
