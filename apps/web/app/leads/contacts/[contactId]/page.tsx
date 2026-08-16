"use client";

import React from "react";
import { MainLayout } from "@/components/main-layout";
import { ContactDetailPage } from "@/components/contact-detail-page";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
    // Navigate back to previous page (leads or contacts list)
    router.back();
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <ContactDetailPage
          contactId={contactId}
          onBack={handleBack}
          onEdit={() => console.log("Edit contact")}
          onDelete={() => {
            console.log("Delete contact");
            handleBack();
          }}
          onSendEmail={() => console.log("Send email")}
          onSendWhatsApp={() => console.log("Send WhatsApp")}
          onScheduleMeeting={() => console.log("Schedule meeting")}
          onUpload={() => console.log("Upload")}
          onDownload={() => console.log("Download")}
          onSave={() => console.log("Save changes")}
          onCancel={() => console.log("Cancel")}
        />
      </MainLayout>
    </ProtectedRoute>
  );
}
