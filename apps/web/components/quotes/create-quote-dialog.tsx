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
} from "@repo/ui";
import { useGenerateQuote } from "@/hooks/useOpportunities";
import { toast } from "@/lib/toast";

type CreateQuoteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  opportunityName?: string;
};

export function CreateQuoteDialog({
  open,
  onOpenChange,
  opportunityId,
}: CreateQuoteDialogProps) {
  const numericId = opportunityId ? Number(opportunityId) : 0;
  const generateQuote = useGenerateQuote(numericId);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) setErrorMessage(null);
  }, [open]);

  const handleConfirm = () => {
    setErrorMessage(null);
    generateQuote.mutate(undefined, {
      onSuccess: () => {
        toast.success("Quote created");
        onOpenChange(false);
      },
      onError: (err: any) => {
        const code = err?.response?.data?.code;
        const message =
          code === "NO_LINE_ITEMS"
            ? "Opportunity has no line items. Add at least one line item in the Products tab before generating a quote."
            : (err?.response?.data?.error ?? "Failed to create quote.");
        setErrorMessage(message);
        toast.error(message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Quote</DialogTitle>
          <DialogDescription>
            Do you want to create a quote with current line items in product?
          </DialogDescription>
        </DialogHeader>
        {errorMessage && (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={generateQuote.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={generateQuote.isPending}>
            {generateQuote.isPending ? "Creating…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
