"use client";

import { useParams } from "next/navigation";
import { RoleGuard } from "@/components/guards/role-guard";
import { QuoteDetailPage } from "@/components/quotes/quote-detail-page";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export default function QuoteDetailRoutePage() {
  const params = useParams<{ id: string }>();
  const quoteId = String(params?.id || "");

  return (
    <NuqsAdapter>
      <RoleGuard allowedRoles={["ADMIN", "SALES"]}>
        <QuoteDetailPage quoteId={quoteId} />
      </RoleGuard>
    </NuqsAdapter>
  );
}
