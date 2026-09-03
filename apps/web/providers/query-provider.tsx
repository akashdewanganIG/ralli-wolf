"use client";

import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { queryClient } from "../lib/query-client";

interface QueryProviderProps {
  children: React.ReactNode;
}

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
