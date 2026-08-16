export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type AdminUser = {
  id: string;
  name: string;
  email?: string;
};

export type Approval = {
  id: string;
  quoteNo: string;
  targetObjectId: string;
  targetRecordId: string;
  status: ApprovalStatus;
  createdBy: string;
  createdById: string;
  createdDate: string;
  completedDate?: string;
  lastActorId?: string;
  lastActorName?: string;
  assigneeId: string;
  assigneeName: string;
  description?: string;
};
