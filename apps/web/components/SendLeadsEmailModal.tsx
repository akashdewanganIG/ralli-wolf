"use client";

import React, { useState } from "react";
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
import { leadService } from "@/lib/api/services";
import { toast } from "@/lib/toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeadIds: number[];
  onSent?: () => void;
};

export const SendLeadsEmailModal: React.FC<Props> = ({
  open,
  onOpenChange,
  selectedLeadIds,
  onSent,
}) => {
  const [to, setTo] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!to) {
      toast.error("Please enter a recipient email");
      return;
    }
    if (!selectedLeadIds || selectedLeadIds.length === 0) {
      toast.error("Please select at least one lead");
      return;
    }

    try {
      setLoading(true);
      await leadService.emailSelectedLeads(to, selectedLeadIds);
      toast.success("Email sent successfully");
      onOpenChange(false);
      onSent?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send email";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {(() => {
        const DialogContentAny = DialogContent as any;
        const DialogHeaderAny = DialogHeader as any;
        const DialogTitleAny = DialogTitle as any;
        const DialogDescriptionAny = DialogDescription as any;
        const DialogFooterAny = DialogFooter as any;
        return (
          <DialogContentAny>
            <DialogHeaderAny>
              <DialogTitleAny>Send selected leads as Excel</DialogTitleAny>
              <DialogDescriptionAny>
                Enter the recipient email address. We will generate an Excel
                file with all fields of the selected leads and send it as an
                attachment.
              </DialogDescriptionAny>
            </DialogHeaderAny>
            <div className="space-y-4">
              <div>
                <Label htmlFor="recipientEmail">Recipient email</Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  placeholder="person@example.com"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedLeadIds?.length || 0} lead(s) will be included. All
                lead fields are exported.
              </div>
            </div>
            <DialogFooterAny>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={
                  loading || !to || (selectedLeadIds?.length || 0) === 0
                }
              >
                {loading ? "Sending..." : "Send Email"}
              </Button>
            </DialogFooterAny>
          </DialogContentAny>
        );
      })()}
    </Dialog>
  );
};
