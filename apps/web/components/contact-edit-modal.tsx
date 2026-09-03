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

export type ContactEditValues = {
  name: string;
  email: string;
  phone?: string;
  position?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

type ContactEditModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues: ContactEditValues;
  isSaving?: boolean;
  onSave: (values: ContactEditValues) => Promise<void> | void;
};

export function ContactEditModal({
  open,
  onOpenChange,
  initialValues,
  isSaving = false,
  onSave,
}: ContactEditModalProps) {
  const [values, setValues] = React.useState(initialValues);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setValues(initialValues);
  }, [open, initialValues]);

  const handleSave = async () => {
    if (!values.name.trim() || !values.email.trim()) return;
    setSaving(true);
    try {
      await onSave(values);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const disabled = saving || isSaving;
  const field = (
    id: string,
    label: string,
    key: keyof ContactEditValues,
    options: { type?: string; maxLength?: number } = {}
  ) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={options.type}
        maxLength={options.maxLength}
        value={values[key] || ""}
        onChange={event =>
          setValues(current => ({ ...current, [key]: event.target.value }))
        }
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Edit contact</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("contact-name", "Name", "name", { maxLength: 255 })}
            {field("contact-email", "Email", "email", {
              type: "email",
              maxLength: 254,
            })}
            {field("contact-phone", "Phone", "phone", { maxLength: 32 })}
            {field("contact-position", "Position", "position", {
              maxLength: 255,
            })}
            {field("contact-city", "City", "city", { maxLength: 100 })}
            {field("contact-state", "State", "state", { maxLength: 100 })}
            {field("contact-pincode", "Pincode", "pincode", { maxLength: 6 })}
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
            disabled={disabled || !values.name.trim() || !values.email.trim()}
          >
            {disabled ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ContactEditModal;
