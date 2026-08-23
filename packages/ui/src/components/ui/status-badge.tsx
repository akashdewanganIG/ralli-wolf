import * as React from "react";

import { Tag, type TagTone } from "@repo/ui/components/ui/tag";

/**
 * The semantic states this system recognises.
 *
 * Everything a status can mean reduces to one of these. Modules do not get
 * their own vocabulary: an ACTIVE supplier, an ACTIVE campaign, and an ACTIVE
 * user are the same state and must look the same, which they did not when
 * Marketing, Sales, and Supply Chain each carried their own status map.
 */
export type SemanticTone = TagTone;

/**
 * Status string → semantic tone.
 *
 * Keys are compared case-insensitively with `-`/space normalised to `_`, so
 * the CRM's `in_process` and Supply Chain's `IN_PROGRESS` land on the same
 * tone without either module restating the mapping.
 */
const TONE_BY_STATUS: Record<string, SemanticTone> = {
  // Live / healthy / complete
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

  // Moving
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

  // Waiting on someone
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

  // Wrong
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

  // Not started / retired
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

/** Resolve any status string to its tone. Unknown values read as neutral. */
export function statusTone(status: string | null | undefined): SemanticTone {
  if (!status) return "neutral";
  return TONE_BY_STATUS[normalise(status)] ?? "neutral";
}

/** `IN_PROGRESS` → `In progress`. Internal to this module. */
function humanizeStatus(status: string) {
  const words = normalise(status).toLowerCase().split("_");
  const [first = "", ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

/**
 * The status pill, everywhere.
 *
 * Replaces the per-module badges that had drifted apart — one rendered a
 * `Badge` with hand-picked surfaces, another a bare `<span>` with its own
 * radius and text size, a third mapped `running` to warning while Supply Chain
 * mapped the equivalent `IN_PROGRESS` to info.
 */
export function StatusBadge({
  status,
  label,
  tone,
  className,
}: {
  status: string | null | undefined;
  /** Overrides the derived label. */
  label?: React.ReactNode;
  /** Overrides the derived tone, for states this map cannot know about. */
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

/**
 * Role → tone.
 *
 * Lives here, not in a page, because the same role is shown in at least two
 * places — the user table and the account menu — and those two had drifted:
 * one drew ADMIN as a red chip, the other as a grey outline. One mapping means
 * a role looks the same wherever it appears.
 */
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

/**
 * Alert severity.
 *
 * Shares the tone palette rather than defining a parallel one; only CRITICAL
 * gets extra weight, because it is the one level meant to stop the reader.
 */
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
    <Tag
      tone={tone}
      // CRITICAL is the one level meant to stop the reader, so it is the one
      // that gets a full-strength surface instead of a tint.
      className={className}
    >
      {humanizeStatus(severity)}
    </Tag>
  );
}
