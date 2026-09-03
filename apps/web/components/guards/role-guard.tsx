"use client";

import React, { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/auth-context";
import { RouteLoadingState } from "../protected-route";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: string[];
  redirectTo?: string;
}

export function RoleGuard({
  children,
  allowedRoles,
  redirectTo = "/unauthorized",
}: RoleGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const isUnauthorized = !!user && !allowedRoles.includes(String(user.role));

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    if (isUnauthorized) {
      router.push(redirectTo);
    }
  }, [isLoading, isAuthenticated, isUnauthorized, redirectTo, router]);

  if (isLoading) {
    return <RouteLoadingState />;
  }

  if (!isAuthenticated || isUnauthorized) {
    return (
      <RouteLoadingState
        label="Redirecting you safely"
        detail="Taking you to a page available for your account…"
      />
    );
  }

  return <>{children}</>;
}

export function useHasRole(role: string | string[]): boolean {
  const { user } = useAuth();

  if (!user) return false;

  if (Array.isArray(role)) {
    return role.includes(String(user.role));
  }

  return String(user.role) === role;
}

export function useIsAdmin(): boolean {
  return useHasRole("ADMIN");
}

export function useIsSales(): boolean {
  return useHasRole("SALES");
}
