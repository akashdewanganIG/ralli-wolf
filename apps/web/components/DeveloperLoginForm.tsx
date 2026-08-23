"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Card, CardContent } from "@repo/ui/components/ui/card";

export function DeveloperLoginForm() {
  const router = useRouter();
  const {
    developerLogin,
    clearError,
    error,
    isDeveloper,
    isAuthenticated,
    isLoading,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && isDeveloper) {
      router.replace("/integration-manager");
    }
  }, [isLoading, isAuthenticated, isDeveloper, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await developerLogin({ email, password });
      router.replace("/integration-manager");
    } catch {
      // error state handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-8 pb-10">
          <div className="mb-4 text-center space-y-2">
            <h1 className="text-base sm:text-lg font-semibold">
              Developer Access
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in with the developer credentials to manage integrations.
            </p>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="developer-email">Email</Label>
              <Input
                id="developer-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="Enter developer email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="developer-password">Password</Label>
              <Input
                id="developer-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Enter developer password"
                required
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-error-surface border border-error-border rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>

            {/* Developer credentials are configured via environment variables on the API */}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
