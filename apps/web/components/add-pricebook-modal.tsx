"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { useCreatePricebook } from "../hooks/use-pricebooks";
import { toast } from "../lib/toast";
import { settingsService } from "../lib/api/services";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type FormState = {
  name: string;
  description: string;
};

export const AddPricebookModal: React.FC<Props> = ({ open, onOpenChange }) => {
  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
  });
  const [globalCurrency, setGlobalCurrency] = useState("INR");

  const createPricebook = useCreatePricebook();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (open) {
      const fetchGlobalCurrency = async () => {
        try {
          const settings = await settingsService.getGlobalSettings();
          if (settings.defaultCurrency) {
            setGlobalCurrency(settings.defaultCurrency);
          }
        } catch (error) {
          console.error("Failed to fetch global currency:", error);
          toast.error("Failed to load global currency setting.");
        }
      };
      fetchGlobalCurrency();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setTouched(new Set());
      setSubmitAttempted(false);
    }
  }, [open]);

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};

    if (!form.name.trim()) {
      e.name = "Name is required.";
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

  const markTouched = (fieldName: string) => {
    setTouched(prev => new Set(prev).add(fieldName));
  };

  const resetAndClose = () => {
    setForm({
      name: "",
      description: "",
    });
    setTouched(new Set());
    setSubmitAttempted(false);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    if (hasErrors) return;
    try {
      setSubmitError(null);
      await createPricebook.mutateAsync({
        name: form.name.trim(),
        description: form.description.trim() || null,
      });
      toast.success("Pricebook created successfully");
      resetAndClose();
    } catch (err) {
      toast.error(err, "Failed to create pricebook");
      const message = (err as any)?.message || "Failed to create pricebook";
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
      <DialogContentAny className="gap-0 overflow-hidden sm:max-w-[30rem]">
        <DialogHeaderAny className="text-center">
          <DialogTitleAny className="text-center">Add Pricebook</DialogTitleAny>
          <DialogDescriptionAny className="text-center">
            Create a new pricebook by providing a name and an optional
            description. Fields marked with{" "}
            <span className="text-destructive">*</span> are required.
          </DialogDescriptionAny>
        </DialogHeaderAny>
        <DialogBody>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">
                Name<span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={update("name")}
                onBlur={() => markTouched("name")}
                placeholder="e.g. Retail Prices"
                autoFocus
                aria-invalid={shouldShowError("name") && !!errors.name}
                aria-describedby={
                  shouldShowError("name") && errors.name
                    ? "name-error"
                    : undefined
                }
              />
              {shouldShowError("name") && errors.name && (
                <p id="name-error" className="text-xs text-destructive mt-1">
                  {errors.name}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={update("description")}
                onBlur={() => markTouched("description")}
                placeholder="e.g. Standard prices for all retail customers"
                aria-invalid={
                  shouldShowError("description") && !!errors.description
                }
                aria-describedby={
                  shouldShowError("description") && errors.description
                    ? "description-error"
                    : undefined
                }
              />
              {shouldShowError("description") && errors.description && (
                <p
                  id="description-error"
                  className="text-xs text-destructive mt-1"
                >
                  {errors.description}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="currencyISOCode">Currency Code</Label>
              <Input
                id="currencyISOCode"
                value={globalCurrency}
                disabled
                className="bg-surface-secondary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This field is configured as a global setting.
              </p>
            </div>
          </div>
        </DialogBody>
        <DialogFooterAny>
          {submitError && (
            <p className="text-sm text-destructive mr-auto" role="alert">
              {submitError}
            </p>
          )}
          <Button
            variant="outline"
            onClick={() => resetAndClose()}
            disabled={createPricebook.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              createPricebook.isPending || (submitAttempted && hasErrors)
            }
          >
            {createPricebook.isPending ? (
              <span className="inline-flex items-center gap-2">
                Creating...
              </span>
            ) : (
              "Create Pricebook"
            )}
          </Button>
        </DialogFooterAny>
      </DialogContentAny>
    </Dialog>
  );
};
