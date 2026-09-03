"use client";

import React from "react";
import { MainLayout } from "@/components/main-layout";
import { ContactDetailPage } from "@/components/contact-detail-page";
import { ProtectedRoute } from "@/components/protected-route";
import { useRouter } from "next/navigation";

interface ContactDetailPageProps {
  params: Promise<{
    contactId: string;
  }>;
}

export default function ContactDetailRoute({ params }: ContactDetailPageProps) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const contactId = parseInt(resolvedParams.contactId);

  const handleBack = () => {
    router.back();
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <ContactDetailPage contactId={contactId} onBack={handleBack} />
      </MainLayout>
    </ProtectedRoute>
  );
}
