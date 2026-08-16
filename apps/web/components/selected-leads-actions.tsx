"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Mail } from "lucide-react";

interface SelectedLeadsActionsProps {
  count: number;
  onSendToEmail?: () => void;
  onEmailExcel: () => void;
  onAssign: () => void;
  onConvert: () => void;
  onDelete: () => void;
}

export function SelectedLeadsActions({
  count,
  onSendToEmail,
  onEmailExcel,
  onAssign,
  onConvert,
  onDelete,
}: SelectedLeadsActionsProps) {
  if (count <= 0) return null;

  return (
    <div className="flex items-center gap-2 mr-4">
      <span className="text-sm text-muted-foreground">{count} selected</span>
      {onSendToEmail && (
        <Button variant="outline" size="sm" onClick={onSendToEmail}>
          <Mail className="h-4 w-4 mr-2" />
          Send to Email
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={onEmailExcel}>
        Email Excel
      </Button>
      <Button variant="outline" size="sm" onClick={onAssign}>
        Assign
      </Button>
      <Button variant="outline" size="sm" onClick={onConvert}>
        Convert Selected
      </Button>
      <Button variant="destructive" size="sm" onClick={onDelete}>
        Delete Selected
      </Button>
    </div>
  );
}

export default SelectedLeadsActions;
