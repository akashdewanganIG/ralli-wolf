"use client";

import { LeadManagementDashboard } from "@/components/lead-management-dashboard";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LeadManagementProvider } from "@/contexts/LeadManagementContext";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export default function LeadMasterPage() {
  return (
    <NuqsAdapter>
      <ProtectedRoute>
        <LeadManagementProvider>
          <LeadManagementDashboard />
        </LeadManagementProvider>
      </ProtectedRoute>
    </NuqsAdapter>
  );
}
