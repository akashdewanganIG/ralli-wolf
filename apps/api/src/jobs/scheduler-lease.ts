import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { logError } from "../utils/logger.js";

const owner =
  process.env.SCHEDULER_INSTANCE_ID?.trim() ||
  `${hostname()}:${process.pid}:${randomUUID()}`;

export function embeddedSchedulersEnabled(): boolean {
  return process.env.RUN_EMBEDDED_SCHEDULERS?.trim().toLowerCase() === "true";
}

export async function runWithSchedulerLease(
  name: string,
  leaseMs: number,
  work: () => Promise<void>
): Promise<boolean> {
  const leasedUntil = new Date(Date.now() + leaseMs);
  const acquired = await prisma.$queryRaw<Array<{ name: string }>>`
    INSERT INTO "scheduler_leases" ("name", "owner", "leased_until", "updated_at")
    VALUES (${name}, ${owner}, ${leasedUntil}, CURRENT_TIMESTAMP)
    ON CONFLICT ("name") DO UPDATE SET
      "owner" = EXCLUDED."owner",
      "leased_until" = EXCLUDED."leased_until",
      "updated_at" = CURRENT_TIMESTAMP
    WHERE "scheduler_leases"."leased_until" <= CURRENT_TIMESTAMP
    RETURNING "name"
  `;
  if (acquired.length === 0) return false;

  const heartbeat = setInterval(
    () => {
      void prisma.schedulerLease
        .updateMany({
          where: { name, owner },
          data: { leasedUntil: new Date(Date.now() + leaseMs) },
        })
        .catch(error =>
          logError("scheduler_lease_renewal_failed", error, { lease: name })
        );
    },
    Math.max(1_000, Math.floor(leaseMs / 3))
  );
  heartbeat.unref();

  try {
    await work();
    return true;
  } finally {
    clearInterval(heartbeat);
    await prisma.schedulerLease.updateMany({
      where: { name, owner },
      data: { leasedUntil: new Date() },
    });
  }
}
