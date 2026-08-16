"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!isAuthenticated || !isDeveloper) {
    return null;
  }

  return <>{children}</>;
}
