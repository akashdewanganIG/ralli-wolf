"use client";

import { Button } from "@repo/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";

interface DeleteTemplateModalProps {
  templateName: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function DeleteTemplateModal({
  templateName,
  onClose,
  onConfirm,
  loading = false,
}: DeleteTemplateModalProps) {
  return (
    <Dialog
      open
      onOpenChange={next => {
        if (!next && !loading) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete template</DialogTitle>
          <DialogDescription>
            {templateName} will be permanently removed from your account. This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            variant="destructive"
          >
            {loading ? "Deleting…" : "Delete template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
