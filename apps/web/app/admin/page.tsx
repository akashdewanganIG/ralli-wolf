"use client";

import Link from "next/link";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { PageHeader } from "@repo/ui/components/ui/page-header";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { ProtectedRoute } from "../../components/protected-route";
import { RoleGuard } from "../../components/guards/role-guard";
import { useHealth } from "../../hooks/use-health";

export default function AdminPage() {
  const { data: health, isLoading, isError } = useHealth();

  return (
    <ProtectedRoute>
      <RoleGuard allowedRoles={["ADMIN"]}>
        <PageShell>
          <PageHeader
            title="Administration"
            description="Monitor the service and manage authenticated user access."
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>System health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Checking…</p>
                ) : isError || !health ? (
                  <Badge variant="destructive">Unavailable</Badge>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span>API</span>
                      <Badge
                        variant={
                          health.status === "ok" ? "default" : "destructive"
                        }
                      >
                        {health.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Database</span>
                      <Badge
                        variant={
                          health.database === "connected"
                            ? "default"
                            : "destructive"
                        }
                      >
                        {health.database}
                      </Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User access</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Create accounts, assign roles and capabilities, revoke access,
                  and rotate generated credentials in the user-management area.
                </p>
                <Button asChild>
                  <Link href="/admin/user-management">Manage users</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </PageShell>
      </RoleGuard>
    </ProtectedRoute>
  );
}
