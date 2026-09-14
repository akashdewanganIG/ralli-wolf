"use client";

import { usePathname, useRouter } from "next/navigation";
import { Loader2Icon } from "@repo/ui/icons";
import { HeaderWrapper } from "./header-wrapper";
import { AppSidebar } from "./app-sidebar";
import { SupportChat } from "./support-chat";
import { useEffect } from "react";
import { useState } from "react";
import { useAuth } from "../contexts/auth-context";

interface AppLayoutWrapperProps {
  children: React.ReactNode;
}

export function AppLayoutWrapper({ children }: AppLayoutWrapperProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const authPages = [
    "/login",
    "/forgot-password",
    "/subdealer",
    "/reset-password",
    "/aakraman",
    "/aakraman/book-a-order",
    "/aakraman/customer-details",
  ];
  const isAuthPage = authPages.some(
    path => pathname === path || pathname.startsWith(`${path}/`)
  );

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isAuthPage || isLoading || isAuthenticated) return;
    router.replace("/login");
  }, [isAuthPage, isLoading, isAuthenticated, router]);

  if (isAuthPage) {
    return <div className="h-svh w-full overflow-y-auto">{children}</div>;
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-svh w-full items-center justify-center bg-background px-6 text-center">
        <div role="status" aria-live="polite">
          <Loader2Icon className="mx-auto size-5 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {isLoading ? "Preparing your workspace…" : "Returning to sign in…"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isLoading
              ? "Checking your secure session."
              : "Your session is not active."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex h-full max-w-screen-3xl overflow-hidden bg-background">
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-[60] bg-overlay backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 z-[70] h-full shrink-0 transition-[left] duration-200 lg:static lg:left-auto lg:z-auto ${
          mobileSidebarOpen ? "left-0" : "-left-52"
        }`}
      >
        <AppSidebar onRequestClose={() => setMobileSidebarOpen(false)} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <HeaderWrapper onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="app-content flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>

      <SupportChat />
    </div>
  );
}
