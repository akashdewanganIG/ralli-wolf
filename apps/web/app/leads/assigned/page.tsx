"use client";

import { LeadManagementDashboard } from "@/components/lead-management-dashboard";
import { ProtectedRoute } from "@/components/protected-route";
import { LeadManagementProvider } from "@/contexts/lead-management-context";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export default function AssignedLeadsPage() {
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
