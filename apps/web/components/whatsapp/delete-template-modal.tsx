"use client";

import { Button } from "@repo/ui";
import { X, AlertTriangle } from "lucide-react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-xl shadow-slate-950/10">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-error-surface p-2">
              <AlertTriangle className="size-5 text-error-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Delete Template</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            disabled={loading}
            aria-label="Close delete template dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-gray-700">
            Are you sure you want to delete the template{" "}
            <span className="font-semibold">"{templateName}"</span>?
          </p>
          <p className="text-sm text-gray-600">
            This action cannot be undone. The template will be permanently
            removed from your account.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-surface-subtle px-4 py-4">
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
            {loading ? "Deleting..." : "Delete Template"}
          </Button>
        </div>
      </div>
    </div>
  );
}
