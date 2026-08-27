import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { openSecret, sealSecret } from "../utils/secretBox.js";

/** The methods an account can authenticate with. */
export type AuthMethod = "password" | "email" | "totp";

/**
 * Accounts must keep at least this many methods enabled and verified.
 *
 * One is enough. What matters is not how many methods an account has but that
 * at least one of them can actually start a sign-in — see {@link signInEntry}.
 */
export const MINIMUM_METHODS = 1;

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
  // Every method can begin a sign-in on its own — see `signInEntry` — so
  // keeping one verified method is the whole rule. Nothing further needs
  // checking: any account that still has a method after this can sign in.
  if (active.length - 1 < MINIMUM_METHODS) {
    return {
      allowed: false,
      reason: `${label(method)} is the only sign-in method on this account. Set another one up before turning it off.`,
    };
  }

  return { allowed: true };
}

/**
 * The method that begins a sign-in for this account.
 *
 * A password is the first step whenever the account keeps one. Without it the
 * account signs in with whichever second factor it verified, which then stands
 * alone — an authenticator in preference to an emailed code, because it does
 * not depend on mail delivery.
 *
 * `null` means the account has no usable method and cannot sign in at all;
 * `canDisable` exists to make that unreachable.
 */
export function signInEntry(
  user: AuthMethodUser
): "password" | "email" | "totp" | null {
  if (user.passwordEnabled) return "password";
  if (user.totpVerifiedAt) return "totp";
  if (user.emailOtpVerifiedAt) return "email";
  return null;
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
