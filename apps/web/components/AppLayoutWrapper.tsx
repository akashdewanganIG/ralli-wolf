"use client";

import { usePathname, useRouter } from "next/navigation";
import { HeaderWrapper } from "./header-wrapper";
import { AppSidebar } from "./appSidebar";
import { useAuth } from "../contexts/AuthContext";
import { useEffect } from "react";
import { useState } from "react";

interface AppLayoutWrapperProps {
  children: React.ReactNode;
}

export function AppLayoutWrapper({ children }: AppLayoutWrapperProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isDeveloper, isAuthenticated } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Pages that should not show sidebar and header
  const authPages = [
    "/login",
    "/signup",
    "/forgot-password",
    "/subdealer",
    "/developer-login",
    "/integration-manager",
    "/reset-password",
    "/aakraman",
    "/aakraman/book-a-order",
    "/aakraman/customer-details",
  ];
  const isAuthPage = authPages.includes(pathname);

  useEffect(() => {
    if (!isAuthenticated || !isDeveloper) {
      return;
    }

    if (pathname !== "/integration-manager") {
      router.replace("/integration-manager");
    }
  }, [isAuthenticated, isDeveloper, pathname, router]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  if (isAuthPage) {
    // `h-svh`, not `min-h-svh`: the body is `overflow-hidden`, so a child that
    // only sets a *minimum* height grows past it and gets clipped rather than
    // scrolling. A fixed viewport height is what lets this container scroll.
    return <div className="h-svh w-full overflow-y-auto">{children}</div>;
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
        {/* No hardcoded background here: the header already paints `bg-navbar`, which follows the theme. */}
        <HeaderWrapper onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="app-content flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
