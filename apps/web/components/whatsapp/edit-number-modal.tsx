"use client";

import { useState } from "react";
import { whatsappService } from "@/lib/api/services";
import { Button, Input, SelectField } from "@repo/ui";
import { toast } from "@/lib/toast";
import { FormDialog } from "@repo/ui/components/ui/form-dialog";
import { Field } from "@/components/supply-chain/shared";

type WhatsAppNumber = {
  id: number;
  displayName: string;
  phoneNumber?: string;
  senderId?: string | null;
  businessId?: string | null;
  status?: string;
  provider: string;
  createdAt: string;
  updatedAt?: string;
};

interface EditNumberModalProps {
  number: WhatsAppNumber;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditNumberModal({
  number,
  onClose,
  onSuccess,
}: EditNumberModalProps) {
  const [displayName, setDisplayName] = useState(number.displayName);
  const [status, setStatus] = useState(number.status || "ACTIVE");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      toast.error("Display name is required");
      return;
    }

    setLoading(true);
    try {
      await whatsappService.updateNumber(number.id, {
        displayName: displayName.trim(),
        status,
        ...(apiKey.trim() && { apiKey: apiKey.trim() }),
      });

      toast.success("WhatsApp number updated successfully");
      onSuccess();
    } catch (error: any) {
      toast.error("Failed to update number: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormDialog
      open
      onOpenChange={next => {
        if (!next && !loading) onClose();
      }}
      size="sm"
      title="Edit WhatsApp number"
      description="The number itself is fixed; its display name and visibility can change."
      onSubmit={handleSubmit}
      isSubmitting={loading}
      submitLabel="Update number"
    >
      <Field label="Phone number" hint="Phone number cannot be changed">
        <Input type="text" value={number.phoneNumber} disabled />
      </Field>

      <Field label="Display name">
        <Input
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="Enter display name"
          required
        />
      </Field>

      <Field label="Status" hint="Inactive numbers do not appear in dropdowns">
        <SelectField value={status} onChange={e => setStatus(e.target.value)}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </SelectField>
      </Field>

      <Field
        label="Rotate API key"
        hint="Leave blank to keep the current encrypted credential"
      >
        <Input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          autoComplete="new-password"
          maxLength={2048}
          placeholder="New MSG91 API key"
        />
      </Field>
    </FormDialog>
  );
}
