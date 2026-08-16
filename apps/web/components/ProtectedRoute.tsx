"use client";

import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RouteLoadingState({
  label = "Preparing your workspace",
  detail = "Checking your session and permissions…",
}: {
  label?: string;
  detail?: string;
}) {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center"
      role="status"
      aria-live="polite"
    >
      <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
        <Loader2
          className="size-5 animate-spin text-primary"
          aria-hidden="true"
        />
      </span>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

export function ProtectedRoute({
  children,
  fallback,
}: ProtectedRouteProps): React.ReactNode {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return typeof fallback !== "undefined" ? (
      <>{fallback}</>
    ) : (
      <RouteLoadingState />
    );
  }

  if (!isAuthenticated) {
    return (
      <RouteLoadingState
        label="Returning you to sign in"
        detail="Your session is no longer active…"
      />
    );
  }

  return <>{children}</>;
}
