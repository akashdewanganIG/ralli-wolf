import jwt, { type SignOptions } from "jsonwebtoken";
import { createHash } from "node:crypto";

export function hashBearerToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function resolveJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) return configured;
  throw new Error(
    "JWT_SECRET is required to sign or verify authentication tokens"
  );
}

const JWT_SECRET = resolveJwtSecret();
const JWT_ISSUER = "ralli-wolf-api";
const JWT_ALGORITHM = "HS256" as const;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

const AUDIENCE = {
  session: "ralli-wolf:staff-session",
  reset: "ralli-wolf:password-reset",
  subdealer: "ralli-wolf:subdealer-session",
  mfa: "ralli-wolf:mfa-challenge",
  aakraman: "ralli-wolf:aakraman-session",
} as const;

type TokenKind =
  | "session"
  | "password-reset"
  | "subdealer"
  | "mfa"
  | "aakraman";

interface ScopedTokenPayload {
  kind: TokenKind;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function signScopedToken(
  payload: Record<string, unknown>,
  kind: TokenKind,
  audience: string,
  expiresIn: SignOptions["expiresIn"]
): string {
  return jwt.sign({ ...payload, kind }, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    audience,
    issuer: JWT_ISSUER,
    expiresIn,
  });
}

function verifyScopedToken<T extends ScopedTokenPayload>(
  token: string,
  kind: TokenKind,
  audience: string,
  validate: (payload: Record<string, unknown>) => boolean
): T {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
      audience,
      issuer: JWT_ISSUER,
    });

    if (!isRecord(decoded) || decoded.kind !== kind || !validate(decoded)) {
      throw new jwt.JsonWebTokenError("Invalid token payload");
    }

    return decoded as T;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Token expired");
    }
    throw new Error("Invalid token");
  }
}

export interface JWTPayload extends ScopedTokenPayload {
  kind: "session";
  userId: number;
  email: string;
  sessionVersion: number;
}

type GenerateTokenOptions = {
  sessionVersion: number;
};

export function generateToken(
  userId: number,
  email: string,
  options: GenerateTokenOptions
): string {
  return signScopedToken(
    {
      userId,
      email,
      sessionVersion: options.sessionVersion,
    },
    "session",
    AUDIENCE.session,
    JWT_EXPIRES_IN as SignOptions["expiresIn"]
  );
}

export function verifyToken(token: string): JWTPayload {
  return verifyScopedToken<JWTPayload>(
    token,
    "session",
    AUDIENCE.session,
    payload =>
      isPositiveInteger(payload.userId) &&
      isNonEmptyString(payload.email) &&
      isNonNegativeInteger(payload.sessionVersion)
  );
}

export interface ResetTokenPayload extends ScopedTokenPayload {
  kind: "password-reset";
  userId: number;
  purpose: "reset";
  sessionVersion: number;

  jti: string;
}

export function generateResetToken(
  userId: number,
  jti: string,
  sessionVersion: number,
  expiresIn: SignOptions["expiresIn"] = "15m"
): string {
  return signScopedToken(
    { userId, purpose: "reset", jti, sessionVersion },
    "password-reset",
    AUDIENCE.reset,
    expiresIn
  );
}

export function verifyResetToken(token: string): ResetTokenPayload {
  return verifyScopedToken<ResetTokenPayload>(
    token,
    "password-reset",
    AUDIENCE.reset,
    payload =>
      payload.purpose === "reset" &&
      isPositiveInteger(payload.userId) &&
      isNonEmptyString(payload.jti) &&
      isNonNegativeInteger(payload.sessionVersion)
  );
}

export interface SubdealerJWTPayload extends ScopedTokenPayload {
  kind: "subdealer";
  subdealerId: number;
  phone: string;
  gstNumber: string;
}

export function generateSubdealerToken(
  subdealerId: number,
  phone: string,
  gstNumber: string
): string {
  return signScopedToken(
    { subdealerId, phone, gstNumber },
    "subdealer",
    AUDIENCE.subdealer,
    "7d"
  );
}

export function verifySubdealerToken(token: string): SubdealerJWTPayload {
  return verifyScopedToken<SubdealerJWTPayload>(
    token,
    "subdealer",
    AUDIENCE.subdealer,
    payload =>
      isPositiveInteger(payload.subdealerId) &&
      isNonEmptyString(payload.phone) &&
      isNonEmptyString(payload.gstNumber)
  );
}

export interface MfaTokenPayload extends ScopedTokenPayload {
  kind: "mfa";
  userId: number;
  purpose: "mfa";
  sessionVersion: number;
}

export function generateMfaToken(
  userId: number,
  sessionVersion: number,
  expiresIn: SignOptions["expiresIn"] = "10m"
): string {
  return signScopedToken(
    { userId, purpose: "mfa", sessionVersion },
    "mfa",
    AUDIENCE.mfa,
    expiresIn
  );
}

export function verifyMfaToken(token: string): MfaTokenPayload {
  return verifyScopedToken<MfaTokenPayload>(
    token,
    "mfa",
    AUDIENCE.mfa,
    payload =>
      payload.purpose === "mfa" &&
      isPositiveInteger(payload.userId) &&
      isNonNegativeInteger(payload.sessionVersion)
  );
}

export interface AakramanTokenPayload extends ScopedTokenPayload {
  kind: "aakraman";
  userId: number;
  phone: string;
  email: string;
  type: "sales_user";
  sessionVersion: number;
}

export function generateAakramanToken(
  userId: number,
  phone: string,
  email: string,
  sessionVersion: number
): string {
  return signScopedToken(
    { userId, phone, email, type: "sales_user", sessionVersion },
    "aakraman",
    AUDIENCE.aakraman,
    "7d"
  );
}

export function verifyAakramanToken(token: string): AakramanTokenPayload {
  return verifyScopedToken<AakramanTokenPayload>(
    token,
    "aakraman",
    AUDIENCE.aakraman,
    payload =>
      payload.type === "sales_user" &&
      isPositiveInteger(payload.userId) &&
      typeof payload.phone === "string" &&
      isNonEmptyString(payload.email) &&
      isNonNegativeInteger(payload.sessionVersion)
  );
}
