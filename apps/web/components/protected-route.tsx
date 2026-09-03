"use client";

import { useAuth } from "../contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Skeleton,
  SkeletonList,
  SkeletonMetricRow,
  SkeletonRegion,
} from "@repo/ui/components/ui/skeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RouteLoadingState({
  label = "Preparing your workspace",
}: {
  label?: string;
  detail?: string;
}) {
  return (
    <SkeletonRegion
      label={label}
      className="flex flex-col gap-4 px-4 pb-8 pt-5 sm:px-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-3.5 w-80" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <SkeletonMetricRow count={4} />
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-3">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="p-3">
          <SkeletonList rows={5} />
        </div>
      </div>
    </SkeletonRegion>
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
