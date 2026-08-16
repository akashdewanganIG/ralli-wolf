"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";

export type AccountEditValues = {
  name: string;
  website?: string;
  email?: string;
  phone?: string;
};

type AccountEditModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues: AccountEditValues;
  isSaving?: boolean;
  onSave: (values: AccountEditValues) => Promise<void> | void;
};

export const AccountEditModal: React.FC<AccountEditModalProps> = ({
  open,
  onOpenChange,
  initialValues,
  isSaving = false,
  onSave,
}) => {
  const [values, setValues] = React.useState<AccountEditValues>(initialValues);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setValues(initialValues);
  }, [open, initialValues]);

  const handleSave = async () => {
    if (!values.name?.trim()) return;
    setSaving(true);
    try {
      await onSave(values);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {(() => {
        const DialogContentAny = DialogContent as any;
        const DialogHeaderAny = DialogHeader as any;
        const DialogTitleAny = DialogTitle as any;
        const DialogFooterAny = DialogFooter as any;
        return (
          <DialogContentAny>
            <DialogHeaderAny className="text-center">
              <DialogTitleAny className="text-center">
                Edit Account
              </DialogTitleAny>
            </DialogHeaderAny>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Name</Label>
                  <Input
                    value={values.name}
                    onChange={e =>
                      setValues(v => ({ ...v, name: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Website</Label>
                  <Input
                    value={values.website || ""}
                    onChange={e =>
                      setValues(v => ({ ...v, website: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={values.email || ""}
                    onChange={e =>
                      setValues(v => ({ ...v, email: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Phone</Label>
                  <Input
                    value={values.phone || ""}
                    onChange={e =>
                      setValues(v => ({ ...v, phone: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooterAny>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving || isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || isSaving}>
                {saving || isSaving ? "Saving..." : "Save"}
              </Button>
            </DialogFooterAny>
          </DialogContentAny>
        );
      })()}
    </Dialog>
  );
};

export default AccountEditModal;
