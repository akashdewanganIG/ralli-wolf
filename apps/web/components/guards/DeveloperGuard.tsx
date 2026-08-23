"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Skeleton,
  SkeletonList,
  SkeletonRegion,
} from "@repo/ui/components/ui/skeleton";

interface DeveloperGuardProps {
  children: ReactNode;
  redirectTo?: string;
}

export function DeveloperGuard({
  children,
  redirectTo = "/developer-login",
}: DeveloperGuardProps) {
  const { isDeveloper, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated || !isDeveloper) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isDeveloper, isLoading, redirectTo, router]);

  if (isLoading) {
    return (
      <SkeletonRegion
        label="Checking developer access"
        className="flex flex-col gap-4 px-4 pb-8 pt-5 sm:px-5"
      >
        <div className="space-y-2">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-3.5 w-72" />
        </div>
        <SkeletonList rows={4} />
      </SkeletonRegion>
    );
  }

  if (!isAuthenticated || !isDeveloper) {
    return null;
  }

  return <>{children}</>;
}
