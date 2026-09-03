import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { approvalService, userService } from "../lib/api/services";
import type { ApprovalProcessApi } from "../lib/api/types";
import type { Approval } from "../components/approvals/approval-types";

export type ApproverOption = { id: number; name: string; email: string };

export const approvalKeys = {
  all: ["approvals"] as const,
  listAll: (params: {
    status?: string;
    targetObjectName?: string;
    page?: number;
    limit?: number;
  }) => [...approvalKeys.all, "list", params] as const,
  listMy: (params: {
    type?: string;
    status?: string;
    targetObjectName?: string;
    page?: number;
    limit?: number;
  }) => [...approvalKeys.all, "my", params] as const,
  detail: (id: number) => [...approvalKeys.all, "detail", id] as const,
};

function buildFullName(
  firstName: string | null,
  lastName: string | null
): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || "—";
}

export function mapApiApprovalToApproval(item: ApprovalProcessApi): Approval {
  const createdByName = item.createdBy
    ? buildFullName(item.createdBy.firstName, item.createdBy.lastName)
    : "—";
  const assigneeName = item.requestedTo
    ? buildFullName(item.requestedTo.firstName, item.requestedTo.lastName)
    : "—";
  const lastActorName = item.lastActor
    ? buildFullName(item.lastActor.firstName, item.lastActor.lastName)
    : undefined;
  return {
    id: String(item.id),
    quoteNo:
      item.targetObjectName === "QUOTE" ? `Quote ${item.targetRecordId}` : `—`,
    targetObjectId: `${item.targetObjectName}:${item.targetRecordId}`,
    targetRecordId: String(item.targetRecordId),
    status: item.status as Approval["status"],
    createdBy: createdByName,
    createdById: String(item.createdById),
    createdDate: item.createdAt,
    completedDate: item.completedDate ?? undefined,
    lastActorId:
      item.lastActorId != null ? String(item.lastActorId) : undefined,
    lastActorName,
    assigneeId: String(item.requestedToId),
    assigneeName,
    description: item.comment ?? undefined,
  };
}

export function useAllApprovals(params?: {
  status?: string;
  targetObjectName?: string;
  page?: number;
  limit?: number;
}) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 10;
  const query = useQuery({
    queryKey: approvalKeys.listAll({ ...params, page, limit }),
    queryFn: () => approvalService.getAllApprovals({ ...params, page, limit }),
    enabled: params != null,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const data = (query.data?.data ?? []).map(mapApiApprovalToApproval);
  return {
    ...query,
    data,
    pagination: query.data?.pagination,
  };
}

export function useMyApprovals(params?: {
  type?: string;
  status?: string;
  targetObjectName?: string;
  page?: number;
  limit?: number;
}) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 10;
  const query = useQuery({
    queryKey: approvalKeys.listMy({ ...params, page, limit }),
    queryFn: () => approvalService.getMyApprovals({ ...params, page, limit }),
    enabled: params != null,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const data = (query.data?.data ?? []).map(mapApiApprovalToApproval);
  return {
    ...query,
    data,
    pagination: query.data?.pagination,
  };
}

export function useApprovers(options?: { enabled?: boolean }) {
  const query = useQuery({
    queryKey: ["approvers"] as const,
    queryFn: async (): Promise<ApproverOption[]> => {
      const [adminRes, systemAdminRes] = await Promise.all([
        userService.getAllUsers({ role: "ADMIN", limit: 100 }),
        userService.getAllUsers({ role: "ADMIN", limit: 100 }),
      ]);
      const adminUsers = adminRes.data ?? [];
      const systemAdminUsers = systemAdminRes.data ?? [];
      const byId = new Map<number, ApproverOption>();
      for (const u of [...systemAdminUsers, ...adminUsers]) {
        if (byId.has(u.id)) continue;
        const name =
          [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
          u.email ||
          `User ${u.id}`;
        byId.set(u.id, { id: u.id, name, email: u.email ?? "" });
      }
      return Array.from(byId.values());
    },
    enabled: options?.enabled !== false,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  return {
    ...query,
    data: query.data ?? [],
  };
}

export function useApprovalById(id: number) {
  return useQuery({
    queryKey: approvalKeys.detail(id),
    queryFn: () => approvalService.getApprovalById(id),
    enabled: !!id,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useActionApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      comment,
    }: {
      id: number;
      action: "APPROVE" | "REJECT";
      comment?: string;
    }) => approvalService.actionApproval(id, { action, comment }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
    },
  });
}
