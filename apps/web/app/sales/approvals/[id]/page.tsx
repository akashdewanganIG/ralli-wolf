"use client";

import { useParams } from "next/navigation";
import { RoleGuard } from "@/components/guards/role-guard";
import { ApprovalDetailPage } from "@/components/approvals/approval-detail-page";

export default function ApprovalDetailRoutePage() {
  const params = useParams<{ id: string }>();
  const approvalId = String(params?.id ?? "");

  return (
    <RoleGuard allowedRoles={["ADMIN", "SALES"]}>
      <ApprovalDetailPage approvalId={approvalId} />
    </RoleGuard>
  );
}
