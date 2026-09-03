import * as React from "react";

import { Tag, type TagTone } from "@repo/ui/components/ui/tag";

export type SemanticTone = TagTone;

const TONE_BY_STATUS: Record<string, SemanticTone> = {
  ACTIVE: "active",
  COMPLETED: "active",
  COMPLETE: "active",
  RECEIVED: "active",
  APPROVED: "active",
  PASS: "active",
  PASSED: "active",
  ISSUED: "active",
  SHIPPED: "active",
  DELIVERED: "active",
  CONVERTED: "active",
  RESOLVED: "active",
  AVAILABLE: "active",
  ENABLED: "active",
  VERIFIED: "active",
  PAID: "active",
  SENT: "active",
  PUBLISHED: "active",
  WON: "active",

  IN_PROGRESS: "progress",
  IN_PROCESS: "progress",
  RUNNING: "progress",
  PROCESSING: "progress",
  RELEASED: "progress",
  ACKNOWLEDGED: "progress",
  PARTIALLY_RECEIVED: "progress",
  PARTIALLY_ISSUED: "progress",
  PARTIALLY_CONVERTED: "progress",
  PICKED: "progress",
  PACKED: "progress",
  ASSIGNED: "progress",
  QC_IN_PROGRESS: "progress",
  SENDING: "progress",

  PENDING: "pending",
  PENDING_APPROVAL: "pending",
  PENDING_QC: "pending",
  SUBMITTED: "pending",
  PLANNED: "pending",
  SCHEDULED: "pending",
  OPEN: "pending",
  ON_HOLD: "pending",
  CONDITIONAL_PASS: "pending",
  QUARANTINE: "pending",
  QUEUED: "pending",
  AWAITING: "pending",
  NEW: "pending",

  REJECTED: "danger",
  FAIL: "danger",
  FAILED: "danger",
  CANCELLED: "danger",
  CANCELED: "danger",
  BLACKLISTED: "danger",
  EXPIRED: "danger",
  BLOCKED: "danger",
  DAMAGED: "danger",
  ERROR: "danger",
  LOST: "danger",
  OVERDUE: "danger",
  BOUNCED: "danger",

  DRAFT: "neutral",
  OBSOLETE: "neutral",
  CLOSED: "neutral",
  INACTIVE: "neutral",
  DISABLED: "neutral",
  ARCHIVED: "neutral",
  CONSUMED: "neutral",
  DISMISSED: "neutral",
  UNASSIGNED: "neutral",
};

function normalise(status: string) {
  return status
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export function statusTone(status: string | null | undefined): SemanticTone {
  if (!status) return "neutral";
  return TONE_BY_STATUS[normalise(status)] ?? "neutral";
}

function humanizeStatus(status: string) {
  const words = normalise(status).toLowerCase().split("_");
  const [first = "", ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

export function StatusBadge({
  status,
  label,
  tone,
  className,
}: {
  status: string | null | undefined;

  label?: React.ReactNode;

  tone?: SemanticTone;
  className?: string;
}) {
  if (!status && !label) {
    return <span className="text-muted-foreground">—</span>;
  }
  const resolved = tone ?? statusTone(status);
  return (
    <Tag tone={resolved} className={className}>
      {label ?? humanizeStatus(String(status))}
    </Tag>
  );
}

const ROLE_TONE: Record<string, SemanticTone> = {
  ADMIN: "danger",
  DEVELOPER: "danger",
  MANAGER: "pending",
  SALES: "progress",
  SALES_USER: "progress",
  USER: "neutral",
};

export function roleTone(role: string | null | undefined): SemanticTone {
  if (!role) return "neutral";
  return ROLE_TONE[normalise(role)] ?? "neutral";
}

const SEVERITY_TONE: Record<string, SemanticTone> = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "pending",
  LOW: "neutral",
  INFO: "progress",
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: string | null | undefined;
  className?: string;
}) {
  if (!severity) return <span className="text-muted-foreground">—</span>;
  const key = normalise(severity);
  const tone = SEVERITY_TONE[key] ?? "neutral";
  return (
    <Tag tone={tone} className={className}>
      {humanizeStatus(severity)}
    </Tag>
  );
}
