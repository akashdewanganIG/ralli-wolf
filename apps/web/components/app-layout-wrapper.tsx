"use client";

import { usePathname } from "next/navigation";
import { HeaderWrapper } from "./header-wrapper";
import { AppSidebar } from "./app-sidebar";
import { SupportChat } from "./support-chat";
import { useEffect } from "react";
import { useState } from "react";

interface AppLayoutWrapperProps {
  children: React.ReactNode;
}

export function AppLayoutWrapper({ children }: AppLayoutWrapperProps) {
  const pathname = usePathname();
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
  const isAuthPage = authPages.includes(pathname);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  if (isAuthPage) {
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
        <HeaderWrapper onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="app-content flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>

      <SupportChat />
    </div>
  );
}
