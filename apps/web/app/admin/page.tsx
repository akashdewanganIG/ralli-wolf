"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Label } from "@repo/ui/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useState } from "react";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { RoleGuard } from "../../components/guards/RoleGuard";
import { useUpdateUserPermissions, useUsers } from "../../hooks/useUsers";
import { useHealth, useWebhookTest } from "../../hooks/useWebhook";

export default function AdminPage() {
  const [webhookPayload, setWebhookPayload] = useState('{"test": "data"}');

  // Hooks
  const { data: usersResponse, isLoading: usersLoading } = useUsers();
  // Extract users array from paginated response and filter out innovunglobal.com users
  const users = (usersResponse?.data || []).filter(user => {
    const emailDomain = user.email?.split("@")[1]?.toLowerCase();
    return emailDomain !== "innovunglobal.com";
  });
  const updatePermissionsMutation = useUpdateUserPermissions();
  const webhookTestMutation = useWebhookTest();
  const { data: health, isLoading: healthLoading } = useHealth();

  const handleTestWebhook = async () => {
    try {
      JSON.parse(webhookPayload);
      await webhookTestMutation.mutateAsync();
    } catch (error) {
      console.error("Webhook test failed:", error);
    }
  };

  const handleUpdatePermissions = async (userId: number, permissions: any) => {
    try {
      await updatePermissionsMutation.mutateAsync({ id: userId, permissions });
    } catch (error) {
      console.error("Failed to update permissions:", error);
    }
  };

  return (
    <ProtectedRoute>
      <RoleGuard allowedRoles={["ADMIN"]}>
        <div className="p-4">
          <h1 className="text-base sm:text-lg font-semibold mb-4">
            Admin Panel
          </h1>

          <Tabs defaultValue="health" className="space-y-4">
            <TabsList>
              <TabsTrigger value="health">System Health</TabsTrigger>
              <TabsTrigger value="webhooks">Webhook Testing</TabsTrigger>
              <TabsTrigger value="users">User Management</TabsTrigger>
            </TabsList>

            <TabsContent value="health">
              <Card>
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                </CardHeader>
                <CardContent>
                  {healthLoading ? (
                    <p>Loading health status...</p>
                  ) : health ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            health.status === "ok" ? "default" : "destructive"
                          }
                        >
                          {health.status}
                        </Badge>
                        <span>API Status</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            health.database === "connected"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {health.database}
                        </Badge>
                        <span>Database Status</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-destructive">
                      Failed to load health status
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="webhooks">
              <Card>
                <CardHeader>
                  <CardTitle>Webhook Testing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="webhook-payload">Test Payload (JSON)</Label>
                    <Textarea
                      id="webhook-payload"
                      value={webhookPayload}
                      onChange={e => setWebhookPayload(e.target.value)}
                      placeholder='{"test": "data"}'
                      className="mt-1"
                    />
                  </div>
                  <Button
                    onClick={handleTestWebhook}
                    disabled={webhookTestMutation.isPending}
                  >
                    {webhookTestMutation.isPending
                      ? "Testing..."
                      : "Test Landingi Webhook"}
                  </Button>
                  {webhookTestMutation.data && (
                    <div className="mt-4 p-4 bg-success-surface border border-success-border rounded">
                      <h4 className="font-semibold text-success-foreground">
                        Webhook Test Result:
                      </h4>
                      <pre className="text-sm text-success-foreground mt-2">
                        {JSON.stringify(webhookTestMutation.data, null, 2)}
                      </pre>
                    </div>
                  )}
                  {webhookTestMutation.error && (
                    <div className="mt-4 p-4 bg-error-surface border border-error-border rounded">
                      <h4 className="font-semibold text-error-foreground">
                        Webhook Test Error:
                      </h4>
                      <p className="text-sm text-error-foreground mt-2">
                        {webhookTestMutation.error.message}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <p>Loading users...</p>
                  ) : (
                    <div className="space-y-4">
                      {users.map(user => (
                        <div key={user.id} className="border rounded p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold">
                                {[user.firstName, user.lastName]
                                  .filter(Boolean)
                                  .join(" ") || "Unknown User"}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {user.email || "No email provided"}
                              </p>
                            </div>
                            {/* Roles and permissions are edited in one place —
                                the user's Edit dialog in User management —
                                rather than through per-flag toggles here. */}
                            <Button size="sm" variant="outline" asChild>
                              <Link href="/admin/user-management">
                                Manage role
                              </Link>
                            </Button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge
                              variant={
                                user.role === "ADMIN" ? "default" : "secondary"
                              }
                            >
                              {user.role ?? "SALES"}
                            </Badge>
                            {user.role === "CUSTOM" ? (
                              <Badge variant="secondary">
                                {(user.permissions ?? []).length} permission
                                {(user.permissions ?? []).length === 1
                                  ? ""
                                  : "s"}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </RoleGuard>
    </ProtectedRoute>
  );
}
