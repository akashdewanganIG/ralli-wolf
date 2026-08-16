import { prisma, Prisma } from "@repo/db";
import { AuditCategory } from "@prisma/client";

interface AuditLogParams {
  action: string;
  changedBy: number;
  entityType: string;
  entityId?: number;
  oldValues?:
    | Record<string, unknown>
    | Prisma.InputJsonValue
    | null
    | undefined;
  newValues?:
    | Record<string, unknown>
    | Prisma.InputJsonValue
    | null
    | undefined;
  category?: AuditCategory;
  subCategory?: string;
}

export async function recordAuditLog({
  action,
  changedBy,
  entityType,
  entityId = 0,
  oldValues = undefined,
  newValues = undefined,
  category,
  subCategory,
}: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entityType,
        entityId,
        changedBy,
        action,
        category,
        subCategory,
        // treat null/undefined as "omit"; otherwise pass through as JSON value
        oldValues:
          oldValues == null ? undefined : (oldValues as Prisma.InputJsonValue),
        newValues:
          newValues == null ? undefined : (newValues as Prisma.InputJsonValue),
      },
    });
  } catch (error) {
    console.error("Failed to record audit log", {
      action,
      entityType,
      changedBy,
      error: error instanceof Error ? error.message : error,
    });
  }
}
