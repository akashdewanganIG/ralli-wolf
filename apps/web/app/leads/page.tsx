"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { TablePageSkeleton } from "@/components/skeletons";

function LeadsRedirectInner() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  useEffect(() => {
    const validTabs = [
      "lead-master",
      "assigned",
      "unassigned-leads",
      "accounts",
      "contacts",
    ];
    if (tab && validTabs.includes(tab)) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete("tab");
      const queryString = newSearchParams.toString();
      const redirectUrl = `/leads/${tab}${queryString ? `?${queryString}` : ""}`;
      window.location.replace(redirectUrl);
      return;
    }
    window.location.replace("/leads/lead-master");
  }, [tab, searchParams]);

  return <TablePageSkeleton filters={2} rows={6} />;
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<TablePageSkeleton filters={2} rows={6} />}>
      <LeadsRedirectInner />
    </Suspense>
  );
}
