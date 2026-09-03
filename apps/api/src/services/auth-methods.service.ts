import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { openSecret, sealSecret } from "../utils/secret-box.js";

export type AuthMethod = "password" | "email" | "totp";

export const MINIMUM_METHODS = 1;

const TOTP_PERIOD_SECONDS = 30;

const EPOCH_TOLERANCE_SECONDS = TOTP_PERIOD_SECONDS;

const TOTP_ISSUER = "Ralli Wolf";

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

  pendingVerification: boolean;
}

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
      reason: `${label(method)} is the only sign-in method on this account. Set another one up before turning it off.`,
    };
  }

  return { allowed: true };
}

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

export function secondFactorFor(user: AuthMethodUser): {
  preferred: "totp" | "email" | null;
  available: Array<"totp" | "email">;
} {
  const available: Array<"totp" | "email"> = [];
  if (user.totpVerifiedAt) available.push("totp");
  if (user.emailOtpVerifiedAt) available.push("email");

  return { preferred: available[0] ?? null, available };
}

export function requiredSignInChallenge(
  user: AuthMethodUser,
  entry: Exclude<ReturnType<typeof signInEntry>, null>
): "totp" | "email" | null {
  return entry === "password" ? secondFactorFor(user).preferred : entry;
}

export function generateTotpSecret() {
  return generateSecret();
}

export function sealTotpSecret(secret: string) {
  return sealSecret(secret);
}

export async function buildTotpEnrolment(email: string, secret: string) {
  const otpauthUrl = generateURI({
    strategy: "totp",
    issuer: TOTP_ISSUER,
    label: email,
    secret,
    period: TOTP_PERIOD_SECONDS,
  });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });

  return { otpauthUrl, qrCodeDataUrl, issuer: TOTP_ISSUER };
}

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

export function formatManualKey(secret: string) {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}
