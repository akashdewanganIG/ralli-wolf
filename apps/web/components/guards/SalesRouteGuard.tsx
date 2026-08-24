"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { RouteLoadingState } from "../ProtectedRoute";

/**
 * SalesRouteGuard Component
 * Ensures sales users can ONLY access /sales routes
 * Redirects them if they try to access other routes
 */
/**
 * Paths a sales user may open even though they sit outside /sales.
 *
 * The notification bell is in the header on every page, the sales workspace
 * included, so the screen that turns those notifications off has to be
 * reachable too — otherwise the sidebar shows them a link that bounces.
 */
const SALES_ALLOWED_PATHS = ["/login", "/unauthorized", "/admin/notifications"];

export function SalesRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const shouldRedirect =
    !isLoading &&
    user?.role === "SALES" &&
    !pathname.startsWith("/sales") &&
    !SALES_ALLOWED_PATHS.includes(pathname);

  useEffect(() => {
    // Wait for auth to load
    if (isLoading) return;

    // If user is not authenticated, let the auth system handle it
    if (!user) return;

    if (shouldRedirect) {
      router.replace("/sales");
    }
  }, [user, isLoading, pathname, router, shouldRedirect]);

  if (shouldRedirect) {
    return (
      <RouteLoadingState
        label="Opening your sales workspace"
        detail="Taking you to a page available for your role…"
      />
    );
  }

  return <>{children}</>;
}
