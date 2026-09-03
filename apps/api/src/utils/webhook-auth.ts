import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "@repo/db";
import { logError } from "./logger.js";

const WEBHOOK_REPLAY_WINDOW_MS = 24 * 60 * 60 * 1000;

function constantTimeTextEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function bearerToken(req: Request): string | null {
  const authorization = req.get("authorization")?.trim();
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

export function verifyWebhookRequest(
  req: Request,
  secret: string,
  hmacHeaderNames: readonly string[] = ["x-webhook-signature"]
): boolean {
  const token = bearerToken(req) ?? req.get("x-webhook-secret")?.trim();
  if (token && constantTimeTextEqual(token, secret)) return true;

  if (!req.rawBody) return false;
  const expected = createHmac("sha256", secret)
    .update(req.rawBody)
    .digest("hex");
  for (const headerName of hmacHeaderNames) {
    const supplied = req
      .get(headerName)
      ?.trim()
      .replace(/^sha256=/i, "");
    if (supplied && constantTimeTextEqual(supplied.toLowerCase(), expected)) {
      return true;
    }
  }
  return false;
}

export function requireWebhookSecret(
  environmentName: string,
  hmacHeaderNames?: readonly string[]
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const secret = process.env[environmentName]?.trim();
    if (!secret) {
      return res.status(503).json({ error: "Webhook is not configured" });
    }
    if (!verifyWebhookRequest(req, secret, hmacHeaderNames)) {
      return res.status(401).json({ error: "Invalid webhook authentication" });
    }
    return next();
  };
}

export function webhookBodyDigest(provider: string, rawBody: Buffer): string {
  return createHash("sha256")
    .update(provider)
    .update("\0")
    .update(rawBody)
    .digest("hex");
}

export async function claimWebhookReceipt(
  provider: string,
  rawBody: Buffer,
  now = new Date()
): Promise<string | null> {
  const bodyDigest = webhookBodyDigest(provider, rawBody);
  await prisma.webhookReceipt.deleteMany({
    where: { expiresAt: { lte: now } },
  });

  try {
    await prisma.webhookReceipt.create({
      data: {
        provider,
        bodyDigest,
        expiresAt: new Date(now.getTime() + WEBHOOK_REPLAY_WINDOW_MS),
      },
    });
    return bodyDigest;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return null;
    }
    throw error;
  }
}

export async function releaseWebhookReceipt(
  provider: string,
  bodyDigest: string
): Promise<void> {
  await prisma.webhookReceipt.deleteMany({ where: { provider, bodyDigest } });
}

export function rejectWebhookReplay(provider: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.rawBody) {
      return res.status(400).json({ error: "Raw webhook body is unavailable" });
    }

    try {
      const bodyDigest = await claimWebhookReceipt(provider, req.rawBody);
      if (!bodyDigest) {
        return res.status(200).json({ message: "Webhook already received" });
      }

      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        void releaseWebhookReceipt(provider, bodyDigest).catch(error => {
          logError("webhook_receipt_release_failed", error, {
            provider,
          });
        });
      };
      res.once("finish", () => {
        if (res.statusCode >= 500) release();
      });
      res.once("close", () => {
        if (!res.writableEnded) release();
      });
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
