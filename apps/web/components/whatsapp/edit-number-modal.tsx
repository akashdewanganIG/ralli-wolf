"use client";

import { useState } from "react";
import { whatsappService } from "@/lib/api/services";
import { Button, Input, SelectField } from "@repo/ui";
import { toast } from "@/lib/toast";
import { X } from "lucide-react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-xl shadow-slate-950/10">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <h2 className="text-lg font-semibold">Edit WhatsApp Number</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            aria-label="Close edit number dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          {/* Phone Number (Read-only) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Phone Number
            </label>
            <Input
              type="text"
              className="bg-muted"
              value={number.phoneNumber}
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">
              Phone number cannot be changed
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Display Name *
            </label>
            <Input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Enter display name"
              required
            />
          </div>

          {/* Status */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Status *</label>
            <SelectField
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </SelectField>
            <p className="text-xs text-gray-500 mt-1">
              Inactive numbers will not appear in dropdowns
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Number"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
