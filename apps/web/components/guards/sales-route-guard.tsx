"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../../contexts/auth-context";
import { RouteLoadingState } from "../protected-route";

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
    if (isLoading) return;

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
