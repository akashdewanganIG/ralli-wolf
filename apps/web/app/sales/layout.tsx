import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Ralli Wolf Operations",
  description: "Ralli Wolf sales operations",
};

export default function SalesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
