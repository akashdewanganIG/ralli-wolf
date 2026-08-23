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

/**
 * Destructive confirmation for a WhatsApp template.
 *
 * On the shared `Dialog` rather than a hand-rolled fixed overlay: that is what
 * supplies the focus trap, Escape handling, focus returning to the trigger, and
 * `aria-modal` — none of which the previous div-with-a-backdrop had.
 */
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
        // Escape and outside-click both route through the one close handler.
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
