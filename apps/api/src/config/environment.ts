import { decodeEncryptionKey } from "@repo/db/crypto";
import { logWarn } from "../utils/logger.js";

function missing(name: string): boolean {
  return !process.env[name]?.trim();
}

const REQUIRED: Array<{ name: string; why: string }> = [
  { name: "DATABASE_URL", why: "the database cannot be reached" },
  {
    name: "JWT_SECRET",
    why: "session tokens would be signed with a known fallback, letting anyone forge one",
  },
  {
    name: "OTP_HASH_SECRET",
    why: "one-time codes require a dedicated server-side hashing key",
  },
  {
    name: "TOTP_ENCRYPTION_KEY",
    why: "authenticator secrets require an independent encryption key",
  },
  {
    name: "ENCRYPTION_KEY",
    why: "integration credentials would otherwise be encrypted with a publicly reproducible empty key",
  },
  {
    name: "RESEND_API_KEY",
    why: "no sign-in code can be delivered, so no user can complete login",
  },
  {
    name: "RESEND_FROM_EMAIL",
    why: "no sign-in code can be delivered, so no user can complete login",
  },
];

const RECOMMENDED: Array<{ name: string; why: string }> = [
  { name: "S3_BUCKET_NAME", why: "file uploads and quote PDFs will fail" },
];

export function assertRequiredEnvironment(): void {
  for (const { name, why } of RECOMMENDED) {
    if (missing(name)) {
      logWarn("recommended_environment_missing", { name, reason: why });
    }
  }

  const absent = REQUIRED.filter(v => missing(v.name));
  const invalid: string[] = [];
  if (!missing("ENCRYPTION_KEY")) {
    try {
      decodeEncryptionKey();
    } catch (error) {
      invalid.push(
        `  - ENCRYPTION_KEY: ${error instanceof Error ? error.message : "invalid value"}`
      );
    }
  }
  for (const name of ["JWT_SECRET", "OTP_HASH_SECRET", "TOTP_ENCRYPTION_KEY"]) {
    const value = process.env[name]?.trim();
    if (value && Buffer.byteLength(value, "utf8") < 32) {
      invalid.push(
        `  - ${name}: must contain at least 32 bytes of secret material`
      );
    }
  }
  if (absent.length === 0 && invalid.length === 0) return;

  const detail = [
    ...absent.map(v => `  - ${v.name}: ${v.why}`),
    ...invalid,
  ].join("\n");
  throw new Error(
    `Refusing to start because required environment configuration is missing or invalid.\n${detail}\n\nSee apps/api/env.example for the full list.`
  );
}

export function serverPort(): number {
  const raw = process.env.PORT?.trim() || "4000";
  const port = Number(raw);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}
