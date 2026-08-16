"use client";

import { useParams } from "next/navigation";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { QuoteLineItemDetailPage } from "@/components/quotes/quote-line-item-detail-page";

export default function QuoteLineItemRoutePage() {
  const params = useParams<{ id: string; lineItemId: string }>();
  const quoteId = String(params?.id || "");
  const lineItemId = String(params?.lineItemId || "");

  return (
    <RoleGuard allowedRoles={["ADMIN", "ADMIN", "SALES"]}>
      <QuoteLineItemDetailPage quoteId={quoteId} lineItemId={lineItemId} />
    </RoleGuard>
  );
}
