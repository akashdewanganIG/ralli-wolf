"use client";

import React from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";

export type AccountEditValues = {
  name: string;
  industry?: string;
  website?: string;
  phone?: string;
  description?: string;
};

type AccountEditModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues: AccountEditValues;
  isSaving?: boolean;
  onSave: (values: AccountEditValues) => Promise<void> | void;
};

export function AccountEditModal({
  open,
  onOpenChange,
  initialValues,
  isSaving = false,
  onSave,
}: AccountEditModalProps) {
  const [values, setValues] = React.useState<AccountEditValues>(initialValues);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setValues(initialValues);
  }, [open, initialValues]);

  const handleSave = async () => {
    if (!values.name.trim()) return;
    setSaving(true);
    try {
      await onSave(values);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const disabled = saving || isSaving;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Edit account</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="account-name">Name</Label>
              <Input
                id="account-name"
                value={values.name}
                maxLength={255}
                onChange={event =>
                  setValues(current => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="account-industry">Industry</Label>
              <Input
                id="account-industry"
                value={values.industry || ""}
                maxLength={255}
                onChange={event =>
                  setValues(current => ({
                    ...current,
                    industry: event.target.value,
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="account-website">Website</Label>
              <Input
                id="account-website"
                value={values.website || ""}
                maxLength={2048}
                onChange={event =>
                  setValues(current => ({
                    ...current,
                    website: event.target.value,
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="account-phone">Phone</Label>
              <Input
                id="account-phone"
                value={values.phone || ""}
                maxLength={32}
                onChange={event =>
                  setValues(current => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="account-description">Description</Label>
              <Textarea
                id="account-description"
                value={values.description || ""}
                maxLength={5000}
                onChange={event =>
                  setValues(current => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={disabled}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={disabled || !values.name.trim()}
          >
            {disabled ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AccountEditModal;
