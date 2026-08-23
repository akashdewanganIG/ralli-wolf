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
import { useUpdateCampaign } from "../hooks/useBrevo";
import { toast } from "../lib/toast";
import type { BrevoCampaign, UpdateCampaignRequest } from "../lib/api/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: BrevoCampaign;
  onUpdated?: () => void;
};

type FormState = {
  name: string;
  subject: string;
  replyTo: string;
  previewText: string;
};

export const EditCampaignModal: React.FC<Props> = ({
  open,
  onOpenChange,
  campaign,
  onUpdated,
}) => {
  const [form, setForm] = useState<FormState>({
    name: campaign.name || "",
    subject: campaign.subject || "",
    replyTo:
      typeof campaign.replyTo === "string"
        ? campaign.replyTo
        : campaign.replyTo?.email || "",
    previewText: campaign.previewText || "",
  });

  // Sync when campaign changes
  useEffect(() => {
    if (campaign) {
      setForm({
        name: campaign.name || "",
        subject: campaign.subject || "",
        replyTo:
          typeof campaign.replyTo === "string"
            ? campaign.replyTo
            : campaign.replyTo?.email || "",
        previewText: campaign.previewText || "",
      });
    }
  }, [campaign]);

  const updateCampaign = useUpdateCampaign();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};

    // Only validate email format if replyTo is provided (not required)
    if (
      form.replyTo.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.replyTo.trim())
    ) {
      e.replyTo = "Please enter a valid email address";
    }

    return e;
  }, [form]);

  const isValid = Object.keys(errors).length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!isValid) {
      setSubmitError("Please fix the errors in the form");
      return;
    }

    try {
      const updateData: UpdateCampaignRequest = {};

      // Only include fields that have values (all fields are optional)
      if (form.name.trim()) {
        updateData.name = form.name.trim();
      }

      if (form.subject.trim()) {
        updateData.subject = form.subject.trim();
      }

      // Only include replyTo if it's not empty
      // Brevo API expects replyTo as a string (email), not an object
      if (form.replyTo && form.replyTo.trim()) {
        const email = form.replyTo.trim();
        // Validate email format
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          updateData.replyTo = email;
        }
      }

      // Only include previewText if it's not empty
      if (form.previewText && form.previewText.trim()) {
        updateData.previewText = form.previewText.trim();
      }

      // Check if at least one field is being updated
      if (Object.keys(updateData).length === 0) {
        setSubmitError("Please update at least one field");
        return;
      }

      console.log("Sending update request:", updateData);

      await updateCampaign.mutateAsync({
        id: campaign.id,
        data: updateData,
      });

      toast.success("Campaign updated successfully");
      onUpdated?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to update campaign:", error);
      setSubmitError(
        error?.message || "Failed to update campaign. Please try again."
      );
      toast.error(error?.message || "Failed to update campaign");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Campaign</DialogTitle>
          <DialogDescription>
            Update the campaign details. Changes will be saved to Brevo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={e =>
                setForm(prev => ({ ...prev, name: e.target.value }))
              }
              placeholder="Enter campaign name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={form.subject}
              onChange={e =>
                setForm(prev => ({ ...prev, subject: e.target.value }))
              }
              placeholder="Enter email subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="replyTo">Reply To</Label>
            <Input
              id="replyTo"
              type="email"
              value={form.replyTo}
              onChange={e =>
                setForm(prev => ({ ...prev, replyTo: e.target.value }))
              }
              placeholder="Enter reply-to email address"
              className={errors.replyTo ? "border-destructive" : ""}
            />
            {errors.replyTo && (
              <p className="text-sm text-destructive">{errors.replyTo}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="previewText">Preview Text</Label>
            <Input
              id="previewText"
              value={form.previewText}
              onChange={e =>
                setForm(prev => ({ ...prev, previewText: e.target.value }))
              }
              placeholder="Enter preview text (shown in email client)"
              maxLength={150}
            />
            <p className="text-xs text-muted-foreground">
              {form.previewText.length}/150 characters
            </p>
          </div>

          {submitError && (
            <div className="p-3 bg-error-surface border border-error-border rounded-md">
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateCampaign.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || updateCampaign.isPending}
            >
              {updateCampaign.isPending ? "Updating..." : "Update Campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditCampaignModal;
