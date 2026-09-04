import type { Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import { prisma } from "@repo/db";
import { logError } from "../utils/logger.js";

type KeyFn = (req: Request) => string;

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: KeyFn;
  countStatusCodes?: readonly number[];
}

let requestsSinceSweep = 0;
const RATE_LIMIT_KEY_VERSION = "v2";

function sweepExpiredBuckets(now: Date) {
  requestsSinceSweep += 1;
  if (requestsSinceSweep < 500) return;

  requestsSinceSweep = 0;
  void prisma.rateLimitBucket
    .deleteMany({ where: { resetAt: { lte: now } } })
    .catch(() => undefined);
}

export function shouldCountRateLimitResponse(
  statusCode: number,
  countStatusCodes?: readonly number[]
): boolean {
  return !countStatusCodes || countStatusCodes.includes(statusCode);
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, keyGenerator, countStatusCodes } = options;
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || "unknown";
    const keyExtra = keyGenerator ? keyGenerator(req) : "";
    const now = new Date();
    sweepExpiredBuckets(now);
    const route = `${req.method}:${req.baseUrl}:${req.route?.path ?? req.path}`;
    const key = createHash("sha256")
      .update(`${RATE_LIMIT_KEY_VERSION}:${route}:${ip}:${keyExtra}`)
      .digest("base64url");

    try {
      const resetAt = new Date(now.getTime() + windowMs);
      const rows = await prisma.$queryRaw<
        Array<{ count: number; reset_at: Date }>
      >`
        INSERT INTO "rate_limit_buckets" ("key", "count", "reset_at", "updated_at")
        VALUES (${key}, 1, ${resetAt}, NOW())
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE
            WHEN "rate_limit_buckets"."reset_at" <= NOW() THEN 1
            ELSE "rate_limit_buckets"."count" + 1
          END,
          "reset_at" = CASE
            WHEN "rate_limit_buckets"."reset_at" <= NOW() THEN EXCLUDED."reset_at"
            ELSE "rate_limit_buckets"."reset_at"
          END,
          "updated_at" = NOW()
        RETURNING "count", "reset_at";
      `;
      const entry = rows[0];
      if (!entry) throw new Error("Rate limit counter was not returned");

      if (countStatusCodes) {
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          res.off("finish", settle);
          res.off("close", settle);
          if (shouldCountRateLimitResponse(res.statusCode, countStatusCodes))
            return;

          void prisma.$executeRaw`
              UPDATE "rate_limit_buckets"
              SET "count" = GREATEST("count" - 1, 0), "updated_at" = NOW()
              WHERE "key" = ${key}
            `.catch(error =>
            logError("rate_limit_refund_failed", error, { route })
          );
        };
        res.once("finish", settle);
        res.once("close", settle);
      }

      if (entry.count <= max) return next();

      const retryAfter = Math.max(
        0,
        Math.ceil((entry.reset_at.getTime() - now.getTime()) / 1000)
      );
      res.setHeader("Retry-After", String(retryAfter));
      return res
        .status(429)
        .json({ error: "Too many requests. Please try again later." });
    } catch (error) {
      return next(error);
    }
  };
}
