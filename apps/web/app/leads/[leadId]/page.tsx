"use client";

import React from "react";
import { MainLayout } from "@/components/main-layout";
import { LeadDetailPage } from "@/components/lead-detail-page";
import { ProtectedRoute } from "@/components/protected-route";
import { useRouter } from "next/navigation";

interface LeadDetailPageProps {
  params: Promise<{
    leadId: string;
  }>;
}

export default function LeadDetailRoute({ params }: LeadDetailPageProps) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const leadId = parseInt(resolvedParams.leadId);

  const handleBack = () => {
    router.back();
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <LeadDetailPage leadId={leadId} onBack={handleBack} />
      </MainLayout>
    </ProtectedRoute>
  );
}
