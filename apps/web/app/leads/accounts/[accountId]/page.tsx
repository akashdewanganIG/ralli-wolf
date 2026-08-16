"use client";

import React from "react";
import { MainLayout } from "@/components/main-layout";
import { AccountDetailPage } from "@/components/account-detail-page";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useRouter } from "next/navigation";

interface AccountDetailPageProps {
  params: Promise<{
    accountId: string;
  }>;
}

export default function AccountDetailRoute({ params }: AccountDetailPageProps) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const accountId = parseInt(resolvedParams.accountId);

  const handleBack = () => {
    // Navigate back to previous page (leads or accounts list)
    router.back();
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <AccountDetailPage
          accountId={accountId}
          onBack={handleBack}
          onEdit={() => console.log("Edit account")}
          onDelete={() => {
            console.log("Delete account");
            handleBack();
          }}
          onSendEmail={() => console.log("Send email")}
          onSendWhatsApp={() => console.log("Send WhatsApp")}
          onScheduleMeeting={() => console.log("Schedule meeting")}
          onAddContact={() => console.log("Add contact")}
          onAddOpportunity={() => console.log("Add opportunity")}
          onReassign={() => console.log("Reassign")}
          onSave={() => console.log("Save changes")}
          onCancel={() => console.log("Cancel")}
        />
      </MainLayout>
    </ProtectedRoute>
  );
}
