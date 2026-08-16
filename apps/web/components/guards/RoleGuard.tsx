"use client";

import React, { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { RouteLoadingState } from "../ProtectedRoute";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: string[];
  redirectTo?: string;
}

/**
 * RoleGuard Component
 * Restricts access to routes based on user roles
 * Redirects unauthorized users to specified route or /unauthorized
 */
export function RoleGuard({
  children,
  allowedRoles,
  redirectTo = "/unauthorized",
}: RoleGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const isUnauthorized = !!user && !allowedRoles.includes(String(user.role));

  useEffect(() => {
    // Wait for auth check to complete
    if (isLoading) return;

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    // Check if user has required role
    if (isUnauthorized) {
      router.push(redirectTo);
    }
  }, [isLoading, isAuthenticated, isUnauthorized, redirectTo, router]);

  // Show loading state while checking auth
  if (isLoading) {
    return <RouteLoadingState />;
  }

  // Don't render children if not authenticated or unauthorized
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

/**
 * Hook to check if user has specific role
 */
export function useHasRole(role: string | string[]): boolean {
  const { user } = useAuth();

  if (!user) return false;

  if (Array.isArray(role)) {
    return role.includes(String(user.role));
  }

  return String(user.role) === role;
}

/**
 * Hook to check if the user holds the top role.
 *
 * ADMIN is now the only elevated role, so these three ask the same question.
 * They are kept as separate names because call sites across the app read better
 * with the specific one, and collapsing them would be a rename with no
 * behavioural payoff.
 */
export function useIsSystemAdmin(): boolean {
  return useHasRole("ADMIN");
}

export function useIsAdmin(): boolean {
  return useHasRole("ADMIN");
}

export function useIsAdminRole(): boolean {
  return useHasRole("ADMIN");
}

/**
 * Hook to check if user is Sales
 */
export function useIsSales(): boolean {
  return useHasRole("SALES");
}
