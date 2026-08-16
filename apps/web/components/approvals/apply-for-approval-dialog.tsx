"use client";

import * as React from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  SearchableSelect,
  Textarea,
} from "@repo/ui";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useApprovers } from "@/hooks/useApprovals";
import { useSubmitQuoteForApproval } from "@/hooks/useQuotes";
import { toast } from "@/lib/toast";

const DEVELOPER_ACCESS_NAME = "Developer Access";

type ApplyForApprovalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  quoteNumber: string;
  createdBy?: string;
  createdById?: string;
  onSuccess?: () => void;
};

export function ApplyForApprovalDialog({
  open,
  onOpenChange,
  quoteId,
  quoteNumber,
  onSuccess,
}: ApplyForApprovalDialogProps) {
  const [assigneeId, setAssigneeId] = React.useState<string>("");
  const [comment, setComment] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const { user: currentUser } = useAuth();
  const {
    data: approvers = [],
    isLoading: approversLoading,
    isError: approversError,
  } = useApprovers({ enabled: open });
  const submitMutation = useSubmitQuoteForApproval(quoteId);

  const selectableApprovers = React.useMemo(
    () =>
      approvers.filter(
        a =>
          a.id !== currentUser?.id &&
          a.name !== DEVELOPER_ACCESS_NAME &&
          !a.name.trim().toLowerCase().startsWith("developer access")
      ),
    [approvers, currentUser?.id]
  );

  React.useEffect(() => {
    if (!open) {
      setAssigneeId("");
      setComment("");
      setErrorMessage(null);
    }
  }, [open]);

  const adminItems = React.useMemo(
    () =>
      selectableApprovers.map(a => ({
        value: String(a.id),
        label: a.name,
        searchText: `${a.name} ${a.email || ""} ${a.id}`,
      })),
    [selectableApprovers]
  );

  const canSubmit = !!assigneeId && !submitMutation.isPending;

  const handleSend = () => {
    if (!canSubmit) return;
    setErrorMessage(null);
    submitMutation.mutate(
      {
        requestedToId: Number(assigneeId),
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Quote submitted for approval");
          onOpenChange(false);
          onSuccess?.();
        },
        onError: (err: any) => {
          const code = err?.response?.data?.code;
          const msg = err?.response?.data?.error;
          if (code === "APPROVAL_EXISTS") {
            setErrorMessage(
              "A pending approval already exists for this quote."
            );
          } else if (msg) {
            setErrorMessage(msg);
          } else {
            setErrorMessage("Failed to submit for approval.");
          }
          toast.error(
            code === "APPROVAL_EXISTS"
              ? "A pending approval already exists for this quote."
              : (msg ?? "Failed to submit for approval.")
          );
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Apply for Approval</DialogTitle>
          <DialogDescription>
            Select an admin to review{" "}
            <span className="font-semibold">{quoteNumber}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Assign to Admin</Label>
            {approversLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading admins…
              </div>
            ) : (
              <SearchableSelect
                value={assigneeId || undefined}
                onValueChange={setAssigneeId}
                placeholder="Select admin"
                searchPlaceholder="Search admins..."
                items={adminItems}
                disabled={approversLoading}
              />
            )}
            {approversError && (
              <p className="text-sm text-destructive">
                Failed to load approvers. You may not have permission to view
                the list.
              </p>
            )}
            {!approversError &&
              selectableApprovers.length === 0 &&
              !approversLoading && (
                <p className="text-sm text-muted-foreground">
                  No other admins or system admins available to assign.
                </p>
              )}
          </div>
          <div className="space-y-2">
            <Label>Comment (optional)</Label>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Note to approver"
              className="min-h-[80px]"
            />
          </div>
          {errorMessage && (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSubmit}>
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending…
              </>
            ) : (
              "Send for Approval"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
