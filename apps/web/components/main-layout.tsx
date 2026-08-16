"use client";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  // Render children directly: an extra wrapper element would break the shared
  // `.app-content > …` page-gutter rule, which only matches direct children.
  return <>{children}</>;
}
