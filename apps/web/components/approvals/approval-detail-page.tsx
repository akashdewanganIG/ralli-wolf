"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  DetailCard,
  DetailPageHeader,
  Badge,
  Label,
  Textarea,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import {
  Hash,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  Link2,
  Calendar,
  Tag,
  MessageSquare,
} from "lucide-react";
import {
  useApprovalById,
  useActionApproval,
  mapApiApprovalToApproval,
} from "@/hooks/useApprovals";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "@/lib/toast";
import { DetailPageSkeleton } from "@/components/skeletons";

type ApprovalDetailPageProps = {
  approvalId: string;
};

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

const STATUS_CLASSES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
};

export function ApprovalDetailPage({ approvalId }: ApprovalDetailPageProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading } = useApprovalById(Number(approvalId));
  const actionApproval = useActionApproval();

  const [showRejectDialog, setShowRejectDialog] = React.useState(false);
  const [rejectComment, setRejectComment] = React.useState("");

  const approval = data?.data ? mapApiApprovalToApproval(data.data) : null;
  const canApproveOrReject =
    approval?.status === "PENDING" &&
    user != null &&
    (String(user.id) === approval.assigneeId || user.role === "ADMIN");

  const handleApprove = () => {
    if (!approval || !canApproveOrReject) return;
    actionApproval.mutate(
      { id: Number(approvalId), action: "APPROVE" },
      {
        onSuccess: () => toast.success("Approval approved successfully"),
        onError: error => toast.error(error, "Failed to approve"),
      }
    );
  };

  const handleRejectConfirm = () => {
    if (!approval || !canApproveOrReject) return;
    actionApproval.mutate(
      {
        id: Number(approvalId),
        action: "REJECT",
        comment: rejectComment || undefined,
      },
      {
        onSuccess: () => {
          setShowRejectDialog(false);
          setRejectComment("");
          toast.success("Approval rejected");
        },
        onError: error => toast.error(error, "Failed to reject"),
      }
    );
  };

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (!approval) {
    return (
      <div className="space-y-5 p-4">
        <div className="text-lg font-semibold">Approval not found</div>
        <Button
          variant="outline"
          onClick={() => router.push("/sales/approvals")}
        >
          Back to Approvals
        </Button>
      </div>
    );
  }

  const objectType = approval.targetObjectId?.split(":")[0] ?? "—";
  const isQuote = approval.targetObjectId?.startsWith("QUOTE:");
  const detailHref = isQuote
    ? `/sales/quotes/${approval.targetRecordId}`
    : undefined;

  const statusIcon =
    approval.status === "APPROVED" ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
    ) : approval.status === "REJECTED" ? (
      <XCircle className="h-3.5 w-3.5 text-red-500" />
    ) : (
      <Clock className="h-3.5 w-3.5 text-amber-500" />
    );

  const statusBg =
    approval.status === "APPROVED"
      ? "bg-green-50"
      : approval.status === "REJECTED"
        ? "bg-red-50"
        : "bg-amber-50";

  return (
    <div className="space-y-5 p-4">
      <DetailPageHeader
        title={`Approval #${approvalId}`}
        status={approval.status}
        statusVariant={
          approval.status === "APPROVED"
            ? "default"
            : approval.status === "REJECTED"
              ? "destructive"
              : "secondary"
        }
        onBack={() => router.push("/sales/approvals")}
        actions={
          canApproveOrReject
            ? [
                {
                  label: actionApproval.isPending ? "Approving..." : "Approve",
                  onClick: handleApprove,
                  variant: "default" as const,
                },
                {
                  label: "Reject",
                  onClick: () => setShowRejectDialog(true),
                  variant: "destructive" as const,
                },
              ]
            : undefined
        }
      />

      <DetailCard title="Approval Details" className="bg-white border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Type */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-50">
              <Tag className="h-3.5 w-3.5 text-violet-500" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                Type
              </p>
              <p className="text-sm font-medium text-gray-700">{objectType}</p>
            </div>
          </div>

          {/* Record */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-50">
              <Hash className="h-3.5 w-3.5 text-sky-500" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                Record
              </p>
              <p className="text-sm font-medium text-gray-700">
                {objectType} #{approval.targetRecordId}
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${statusBg}`}
            >
              {statusIcon}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                Status
              </p>
              <Badge
                className={
                  STATUS_CLASSES[approval.status] ?? "bg-gray-100 text-gray-800"
                }
              >
                {approval.status}
              </Badge>
            </div>
          </div>

          {/* Assigned To */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-50">
              <User className="h-3.5 w-3.5 text-indigo-500" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                Assignee
              </p>
              <p className="text-sm font-medium text-gray-700">
                {approval.assigneeName}
              </p>
            </div>
          </div>

          {/* Submitted By */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
              <User className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                Raised By
              </p>
              <p className="text-sm font-medium text-gray-700">
                {approval.createdBy}
              </p>
            </div>
          </div>

          {/* Submitted On */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                Created Date
              </p>
              <p className="text-sm font-medium text-gray-700">
                {formatDateTime(approval.createdDate)}
              </p>
            </div>
          </div>

          {/* Completed On */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-purple-50">
              <Clock className="h-3.5 w-3.5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                Completed Date
              </p>
              <p className="text-sm font-medium text-gray-700">
                {approval.completedDate
                  ? formatDateTime(approval.completedDate)
                  : "N/A"}
              </p>
            </div>
          </div>

          {/* Last Actor */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100">
              <User className="h-3.5 w-3.5 text-gray-500" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                Last Actor
              </p>
              <p className="text-sm font-medium text-gray-700">
                {approval.lastActorName ?? "N/A"}
              </p>
            </div>
          </div>

          {/* View Record Link */}
          {detailHref && (
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                <Link2 className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Record Link
                </p>
                <a
                  href={detailHref}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  View Quote
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Comment */}
        {approval.description && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100">
              <MessageSquare className="h-3.5 w-3.5 text-gray-500" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                Comment
              </p>
              <p className="text-sm font-medium text-gray-700 whitespace-pre-wrap">
                {approval.description}
              </p>
            </div>
          </div>
        )}
      </DetailCard>

      <Dialog
        open={showRejectDialog}
        onOpenChange={open => {
          setShowRejectDialog(open);
          if (!open) setRejectComment("");
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason (optional)</Label>
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectComment}
              onChange={e => setRejectComment(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectComment("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={actionApproval.isPending}
            >
              {actionApproval.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
