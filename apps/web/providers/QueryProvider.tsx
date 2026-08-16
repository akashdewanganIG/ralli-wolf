"use client";

import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { queryClient } from "../lib/queryClient";

interface QueryProviderProps {
  children: React.ReactNode;
}

// Lazy load devtools only in development using next/dynamic (works better with Turbopack)
const ReactQueryDevtools = dynamic(
  () =>
    import("@tanstack/react-query-devtools").then(d => d.ReactQueryDevtools),
  {
    ssr: false,
  }
);

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
}
