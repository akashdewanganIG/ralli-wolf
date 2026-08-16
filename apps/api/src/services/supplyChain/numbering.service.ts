import { prisma } from "@repo/db";
import { Prisma } from "@prisma/client";

/**
 * Document families that get a human-readable, gap-tolerant running number.
 * The key is also the row key in `number_sequences`.
 */
export const SEQUENCE_KEYS = {
  STOCK_MOVEMENT: "STOCK_MOVEMENT",
  STOCK_LOT: "STOCK_LOT",
  STOCK_COUNT: "STOCK_COUNT",
  PUTAWAY_TASK: "PUTAWAY_TASK",
  PICK_LIST: "PICK_LIST",
  PACKAGE: "PACKAGE",
  PALLET: "PALLET",
  BOM: "BOM",
  SUPPLIER: "SUPPLIER",
  PURCHASE_REQUISITION: "PURCHASE_REQUISITION",
  PURCHASE_ORDER: "PURCHASE_ORDER",
  GOODS_RECEIPT: "GOODS_RECEIPT",
  QUALITY_CHECK: "QUALITY_CHECK",
  MATERIAL_REQUISITION: "MATERIAL_REQUISITION",
  PRODUCTION_ORDER: "PRODUCTION_ORDER",
} as const;

export type SequenceKey = (typeof SEQUENCE_KEYS)[keyof typeof SEQUENCE_KEYS];

interface SequenceDefaults {
  prefix: string;
  padding: number;
  resetPeriod: "NONE" | "YEARLY" | "MONTHLY";
}

/**
 * Seed values used the first time a family issues a number. Once the row
 * exists it is authoritative, so an admin can change a prefix in the database
 * without touching code.
 */
const SEQUENCE_DEFAULTS: Record<SequenceKey, SequenceDefaults> = {
  STOCK_MOVEMENT: { prefix: "MOV", padding: 7, resetPeriod: "YEARLY" },
  STOCK_LOT: { prefix: "LOT", padding: 7, resetPeriod: "YEARLY" },
  STOCK_COUNT: { prefix: "CNT", padding: 5, resetPeriod: "YEARLY" },
  PUTAWAY_TASK: { prefix: "PUT", padding: 6, resetPeriod: "YEARLY" },
  PICK_LIST: { prefix: "PCK", padding: 6, resetPeriod: "YEARLY" },
  PACKAGE: { prefix: "PKG", padding: 6, resetPeriod: "YEARLY" },
  PALLET: { prefix: "PLT", padding: 6, resetPeriod: "NONE" },
  BOM: { prefix: "BOM", padding: 5, resetPeriod: "NONE" },
  SUPPLIER: { prefix: "SUP", padding: 5, resetPeriod: "NONE" },
  PURCHASE_REQUISITION: { prefix: "PR", padding: 5, resetPeriod: "YEARLY" },
  PURCHASE_ORDER: { prefix: "PO", padding: 5, resetPeriod: "YEARLY" },
  GOODS_RECEIPT: { prefix: "GRN", padding: 5, resetPeriod: "YEARLY" },
  QUALITY_CHECK: { prefix: "QC", padding: 5, resetPeriod: "YEARLY" },
  MATERIAL_REQUISITION: { prefix: "MR", padding: 5, resetPeriod: "YEARLY" },
  PRODUCTION_ORDER: { prefix: "PRO", padding: 5, resetPeriod: "YEARLY" },
};

function periodKeyFor(resetPeriod: string, now: Date): string {
  const year = now.getUTCFullYear();
  if (resetPeriod === "MONTHLY") {
    return `${year}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  if (resetPeriod === "YEARLY") {
    return String(year);
  }
  return "ALL";
}

interface SequenceRow {
  last_value: number;
  prefix: string;
  padding: number;
  period_key: string | null;
  reset_period: string;
}

/**
 * Reserve the next number for a document family.
 *
 * The counter is bumped by a single `INSERT ... ON CONFLICT DO UPDATE ...
 * RETURNING`, which Postgres executes atomically and which takes a row lock
 * for the duration of the surrounding transaction. Two concurrent callers
 * therefore serialise on the sequence row and can never receive the same
 * number, unlike the "read the highest existing number and add one" pattern.
 *
 * Always pass the transaction client of the document being created so the
 * number and the document commit or roll back together.
 */
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  key: SequenceKey,
  now: Date = new Date()
): Promise<string> {
  const defaults = SEQUENCE_DEFAULTS[key];
  const periodKey = periodKeyFor(defaults.resetPeriod, now);

  const rows = await tx.$queryRaw<SequenceRow[]>`
    INSERT INTO "number_sequences" ("key", "prefix", "last_value", "padding", "reset_period", "period_key", "created_at", "updated_at")
    VALUES (${key}, ${defaults.prefix}, 1, ${defaults.padding}, ${defaults.resetPeriod}, ${periodKey}, NOW(), NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "last_value" = CASE
        WHEN "number_sequences"."period_key" IS DISTINCT FROM EXCLUDED."period_key" THEN 1
        ELSE "number_sequences"."last_value" + 1
      END,
      "period_key" = EXCLUDED."period_key",
      "updated_at" = NOW()
    RETURNING "last_value", "prefix", "padding", "period_key", "reset_period";
  `;

  const row = rows[0];
  if (!row) {
    throw new Error(
      `Failed to reserve a document number for sequence "${key}"`
    );
  }

  const counter = String(row.last_value).padStart(row.padding, "0");
  const segments = [row.prefix];
  if (
    row.reset_period !== "NONE" &&
    row.period_key &&
    row.period_key !== "ALL"
  ) {
    segments.push(row.period_key);
  }
  segments.push(counter);
  return segments.join("-");
}

/**
 * Convenience wrapper for callers that are not already inside a transaction.
 * Prefer {@link nextDocumentNumber} whenever a document is being written.
 */
export async function reserveDocumentNumber(key: SequenceKey): Promise<string> {
  return prisma.$transaction(tx => nextDocumentNumber(tx, key));
}

/**
 * Returns the configuration rows so the UI can show, and an admin can edit,
 * how each document family is numbered.
 */
export async function listSequences() {
  return prisma.numberSequence.findMany({ orderBy: { key: "asc" } });
}
