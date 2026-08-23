import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { openSecret, sealSecret } from "../utils/secretBox.js";

/** The methods an account can authenticate with. */
export type AuthMethod = "password" | "email" | "totp";

/** Accounts must keep at least this many methods enabled and verified. */
export const MINIMUM_METHODS = 2;

/** Standard 30-second step; every authenticator app assumes it. */
const TOTP_PERIOD_SECONDS = 30;

// One step of tolerance either side, expressed in seconds as otplib v13
// wants. This absorbs ordinary clock drift between the server and the
// user's phone without meaningfully widening the guess space.
const EPOCH_TOLERANCE_SECONDS = TOTP_PERIOD_SECONDS;

export interface AuthMethodUser {
  id: number;
  email: string;
  passwordEnabled: boolean;
  totpSecret: string | null;
  totpVerifiedAt: Date | null;
  emailOtpVerifiedAt: Date | null;
}

export interface AuthMethodStatus {
  method: AuthMethod;
  enabled: boolean;
  verified: boolean;
  /** True while a secret exists but no code has proved it yet. */
  pendingVerification: boolean;
}

/**
 * A method counts toward the minimum only when it is both enabled and proved.
 * Opening the authenticator setup screen writes a secret; that alone must not
 * let the user disable something else.
 */
export function describeMethods(user: AuthMethodUser): AuthMethodStatus[] {
  return [
    {
      method: "password",
      enabled: user.passwordEnabled,
      verified: user.passwordEnabled,
      pendingVerification: false,
    },
    {
      method: "email",
      enabled: !!user.emailOtpVerifiedAt,
      verified: !!user.emailOtpVerifiedAt,
      pendingVerification: false,
    },
    {
      method: "totp",
      enabled: !!user.totpVerifiedAt,
      verified: !!user.totpVerifiedAt,
      pendingVerification: !!user.totpSecret && !user.totpVerifiedAt,
    },
  ];
}

export function activeMethods(user: AuthMethodUser): AuthMethod[] {
  return describeMethods(user)
    .filter(m => m.enabled && m.verified)
    .map(m => m.method);
}

/**
 * Whether `method` may be turned off right now.
 *
 * Returns a reason rather than a bare boolean so the API can explain the
 * refusal instead of failing silently.
 */
export function canDisable(
  user: AuthMethodUser,
  method: AuthMethod
): { allowed: true } | { allowed: false; reason: string } {
  const active = activeMethods(user);

  if (!active.includes(method)) {
    return { allowed: false, reason: `${label(method)} is not enabled.` };
  }
  if (active.length - 1 < MINIMUM_METHODS) {
    return {
      allowed: false,
      reason: `Your account must keep at least ${MINIMUM_METHODS} verified sign-in methods. Add another method before turning ${label(method)} off.`,
    };
  }
  return { allowed: true };
}

export function label(method: AuthMethod): string {
  switch (method) {
    case "password":
      return "Password";
    case "email":
      return "Email code";
    case "totp":
      return "Authenticator app";
  }
}

/**
 * Which challenge to present after a password check.
 *
 * The authenticator is preferred when enrolled: it is faster and does not
 * depend on mail delivery. Email remains available as a fallback whenever it
 * is also verified.
 */
export function secondFactorFor(user: AuthMethodUser): {
  preferred: "totp" | "email" | null;
  available: Array<"totp" | "email">;
} {
  const available: Array<"totp" | "email"> = [];
  if (user.totpVerifiedAt) available.push("totp");
  if (user.emailOtpVerifiedAt) available.push("email");

  return { preferred: available[0] ?? null, available };
}

// ---------------------------------------------------------------- TOTP ----

export function generateTotpSecret() {
  return generateSecret();
}

export function sealTotpSecret(secret: string) {
  return sealSecret(secret);
}

/**
 * Builds the `otpauth://` URI every authenticator app understands, plus a QR
 * rendering of it. Issuer and account name are what the user sees in their app.
 */
export async function buildTotpEnrolment(email: string, secret: string) {
  const issuer = process.env.TOTP_ISSUER?.trim() || "Ralli Wolf";
  const otpauthUrl = generateURI({
    strategy: "totp",
    issuer,
    label: email,
    secret,
    period: TOTP_PERIOD_SECONDS,
  });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });

  return { otpauthUrl, qrCodeDataUrl, issuer };
}

/** Constant-time-ish check delegated to otplib; never throws on bad input. */
export function verifyTotp(sealedSecret: string, token: string): boolean {
  try {
    return verifySync({
      strategy: "totp",
      token: token.replace(/\s+/g, ""),
      secret: openSecret(sealedSecret),
      period: TOTP_PERIOD_SECONDS,
      epochTolerance: EPOCH_TOLERANCE_SECONDS,
    }).valid;
  } catch {
    return false;
  }
}

/** Formats the shared secret in the four-character groups apps expect. */
export function formatManualKey(secret: string) {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}
