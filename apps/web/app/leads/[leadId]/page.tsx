"use client";

import React from "react";
import { MainLayout } from "@/components/main-layout";
import { LeadDetailPage } from "@/components/lead-detail-page";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
    // Navigate back to leads list, preserving any tab state from referrer
    router.back();
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <LeadDetailPage
          leadId={leadId}
          onBack={handleBack}
          onEdit={() => {
            console.log("Lead edit initiated");
          }}
          onDelete={() => {
            console.log("Lead delete initiated");
            handleBack();
          }}
          onConvert={() => {
            console.log("Lead convert initiated");
          }}
          onSendEmail={() => console.log("Send email")}
          onSendWhatsApp={() => console.log("Send WhatsApp")}
        />
      </MainLayout>
    </ProtectedRoute>
  );
}
