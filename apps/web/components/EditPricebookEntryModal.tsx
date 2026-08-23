"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { useUpdatePricebookEntry } from "../hooks/usePricebookEntries";
import { toast } from "../lib/toast";
import { PriceBookEntry } from "../lib/api/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: PriceBookEntry | null;
};

type FormState = {
  listPrice: string;
  isActive: boolean;
};

export const EditPricebookEntryModal: React.FC<Props> = ({
  open,
  onOpenChange,
  entry,
}) => {
  const [form, setForm] = useState<FormState>({
    listPrice: "",
    isActive: true,
  });

  useEffect(() => {
    if (entry) {
      setForm({
        listPrice: String(entry.listPrice),
        isActive: entry.isActive,
      });
    }
  }, [entry]);

  const updatePricebookEntry = useUpdatePricebookEntry();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (
      !form.listPrice ||
      isNaN(Number(form.listPrice)) ||
      Number(form.listPrice) <= 0
    ) {
      e.listPrice = "A valid price is required.";
    }
    return e;
  }, [form]);

  const hasErrors = Object.keys(errors).length > 0;

  const shouldShowError = (fieldName: string) => {
    return touched.has(fieldName) || submitAttempted;
  };

  const update =
    (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [key]: e.target.value }));
    };

  const updateChecked = (key: keyof FormState) => (checked: boolean) => {
    setForm(prev => ({ ...prev, [key]: checked }));
  };

  const markTouched = (fieldName: string) => {
    setTouched(prev => new Set(prev).add(fieldName));
  };

  const resetAndClose = () => {
    setTouched(new Set());
    setSubmitAttempted(false);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    if (hasErrors || !entry) return;
    try {
      setSubmitError(null);
      await updatePricebookEntry.mutateAsync({
        id: entry.id,
        data: {
          listPrice: Number(form.listPrice),
          isActive: form.isActive,
        },
      });
      toast.success("Price book entry updated successfully");
      resetAndClose();
    } catch (err) {
      toast.error(err, "Failed to update price book entry");
      const message =
        (err as any)?.message || "Failed to update price book entry";
      setSubmitError(message);
    }
  };

  const DialogContentAny = DialogContent as any;
  const DialogHeaderAny = DialogHeader as any;
  const DialogFooterAny = DialogFooter as any;
  const DialogTitleAny = DialogTitle as any;
  const DialogDescriptionAny = DialogDescription as any;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentAny className="sm:max-w-[30rem]">
        <DialogHeaderAny className="text-center">
          <DialogTitleAny className="text-center">
            Edit Price Book Entry
          </DialogTitleAny>
          <DialogDescriptionAny className="text-center">
            Update the details for this price book entry. Fields marked with{" "}
            <span className="text-destructive">*</span> are required.
          </DialogDescriptionAny>
        </DialogHeaderAny>
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="listPrice">
              List Price<span className="text-destructive">*</span>
            </Label>
            <Input
              id="listPrice"
              type="number"
              value={form.listPrice}
              onChange={update("listPrice")}
              onBlur={() => markTouched("listPrice")}
              placeholder="e.g. 99.99"
              aria-invalid={shouldShowError("listPrice") && !!errors.listPrice}
            />
            {shouldShowError("listPrice") && errors.listPrice && (
              <p className="text-xs text-destructive mt-1">
                {errors.listPrice}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isActive"
              checked={form.isActive}
              onCheckedChange={updateChecked("isActive")}
            />
            <label
              htmlFor="isActive"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Is Active
            </label>
          </div>
        </div>
        <DialogFooterAny>
          {submitError && (
            <p className="text-sm text-destructive mr-auto" role="alert">
              {submitError}
            </p>
          )}
          <Button
            variant="outline"
            onClick={resetAndClose}
            disabled={updatePricebookEntry.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              updatePricebookEntry.isPending || (submitAttempted && hasErrors)
            }
          >
            {updatePricebookEntry.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooterAny>
      </DialogContentAny>
    </Dialog>
  );
};

export default EditPricebookEntryModal;
