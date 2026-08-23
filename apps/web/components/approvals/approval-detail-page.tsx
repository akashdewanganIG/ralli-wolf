"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  DetailCard,
  DetailPageHeader,
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
} from "@repo/ui/icons";
import {
  useApprovalById,
  useActionApproval,
  mapApiApprovalToApproval,
} from "@/hooks/useApprovals";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "@/lib/toast";
import { DetailPageSkeleton } from "@/components/skeletons";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { statusTone } from "@repo/ui/components/ui/status-badge";
import { Tag as StatusTag } from "@repo/ui/components/ui/tag";

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
      <PageShell>
        <div className="text-lg font-semibold">Approval not found</div>
        <Button
          variant="outline"
          onClick={() => router.push("/sales/approvals")}
        >
          Back to Approvals
        </Button>
      </PageShell>
    );
  }

  const objectType = approval.targetObjectId?.split(":")[0] ?? "—";
  const isQuote = approval.targetObjectId?.startsWith("QUOTE:");
  const detailHref = isQuote
    ? `/sales/quotes/${approval.targetRecordId}`
    : undefined;

  const statusIcon =
    approval.status === "APPROVED" ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
    ) : approval.status === "REJECTED" ? (
      <XCircle className="h-3.5 w-3.5 text-destructive" />
    ) : (
      <Clock className="h-3.5 w-3.5 text-warning" />
    );

  const statusBg =
    approval.status === "APPROVED"
      ? "bg-success-surface"
      : approval.status === "REJECTED"
        ? "bg-error-surface"
        : "bg-warning-surface";

  return (
    <PageShell>
      <DetailPageHeader
        title={`Approval #${approvalId}`}
        status={approval.status}
        statusTone={statusTone(approval.status)}
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

      <DetailCard title="Approval Details" className="bg-surface border-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Type */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                Type
              </p>
              <p className="text-sm font-medium text-text-secondary">
                {objectType}
              </p>
            </div>
          </div>

          {/* Record */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                Record
              </p>
              <p className="text-sm font-medium text-text-secondary">
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
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                Status
              </p>
              <StatusTag tone={statusTone(approval.status)}>
                {approval.status}
              </StatusTag>
            </div>
          </div>

          {/* Assigned To */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-surface">
              <User className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                Assignee
              </p>
              <p className="text-sm font-medium text-text-secondary">
                {approval.assigneeName}
              </p>
            </div>
          </div>

          {/* Submitted By */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-info-surface">
              <User className="h-3.5 w-3.5 text-info" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                Raised By
              </p>
              <p className="text-sm font-medium text-text-secondary">
                {approval.createdBy}
              </p>
            </div>
          </div>

          {/* Submitted On */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-info-surface">
              <Calendar className="h-3.5 w-3.5 text-info" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                Created Date
              </p>
              <p className="text-sm font-medium text-text-secondary">
                {formatDateTime(approval.createdDate)}
              </p>
            </div>
          </div>

          {/* Completed On */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                Completed Date
              </p>
              <p className="text-sm font-medium text-text-secondary">
                {approval.completedDate
                  ? formatDateTime(approval.completedDate)
                  : "N/A"}
              </p>
            </div>
          </div>

          {/* Last Actor */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                Last Actor
              </p>
              <p className="text-sm font-medium text-text-secondary">
                {approval.lastActorName ?? "N/A"}
              </p>
            </div>
          </div>

          {/* View Record Link */}
          {detailHref && (
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-info-surface">
                <Link2 className="h-3.5 w-3.5 text-info" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  Record Link
                </p>
                <a
                  href={detailHref}
                  className="text-sm font-medium text-info-foreground hover:text-info"
                >
                  View Quote
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Comment */}
        {approval.description && (
          <div className="mt-4 pt-4 border-t border-subtle flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                Comment
              </p>
              <p className="text-sm font-medium text-text-secondary whitespace-pre-wrap">
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
    </PageShell>
  );
}
