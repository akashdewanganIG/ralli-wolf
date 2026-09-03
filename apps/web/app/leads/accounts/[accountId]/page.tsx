"use client";

import React from "react";
import { MainLayout } from "@/components/main-layout";
import { AccountDetailPage } from "@/components/account-detail-page";
import { ProtectedRoute } from "@/components/protected-route";
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
    router.back();
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <AccountDetailPage accountId={accountId} onBack={handleBack} />
      </MainLayout>
    </ProtectedRoute>
  );
}
