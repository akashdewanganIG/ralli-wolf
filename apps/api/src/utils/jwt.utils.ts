import jwt, { SignOptions } from "jsonwebtoken";

/**
 * The signing key for every token this service issues.
 *
 * There used to be a hard-coded fallback here. That string is in the repository,
 * so any deployment that forgot to set `JWT_SECRET` was signing sessions with a
 * value the whole world can read — and forging an admin token needs nothing more
 * than that. The fallback now exists only outside production, and only loudly.
 */
function resolveJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET is not set. Refusing to sign tokens with a known fallback key."
    );
  }

  console.warn(
    "⚠️  JWT_SECRET is not set; using a development-only fallback. Tokens signed with it are forgeable by anyone with the source."
  );
  return "fallback-secret-key-change-in-production";
}

const JWT_SECRET = resolveJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

export interface JWTPayload {
  userId: number;
  email: string;
  isDeveloper?: boolean;
  iat?: number;
  exp?: number;
}

type GenerateTokenOptions = {
  isDeveloper?: boolean;
};

export function generateToken(
  userId: number,
  email: string,
  options: GenerateTokenOptions = {}
): string {
  const payload: Omit<JWTPayload, "iat" | "exp"> = {
    userId,
    email,
    ...(options.isDeveloper ? { isDeveloper: true } : {}),
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid token");
    } else if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Token expired");
    } else {
      throw new Error("Token verification failed");
    }
  }
}

// Scoped tokens (e.g., password reset)
export interface ResetTokenPayload {
  userId: number;
  purpose: "reset";
  jti: string; // unique id to correlate with reset record
  iat?: number;
  exp?: number;
}

export function generateResetToken(
  userId: number,
  jti: string,
  expiresIn: string = "15m"
): string {
  const payload: Omit<ResetTokenPayload, "iat" | "exp"> = {
    userId,
    purpose: "reset",
    jti,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as SignOptions);
}

export function verifyResetToken(token: string): ResetTokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as ResetTokenPayload;
    if (decoded.purpose !== "reset") {
      throw new Error("Invalid reset token scope");
    }
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid token");
    } else if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Token expired");
    } else {
      throw new Error("Token verification failed");
    }
  }
}

// Subdealer tokens
export interface SubdealerJWTPayload {
  subdealerId: number;
  phone: string;
  gstNumber: string;
  iat?: number;
  exp?: number;
}

export function generateSubdealerToken(
  subdealerId: number,
  phone: string,
  gstNumber: string
): string {
  const payload: Omit<SubdealerJWTPayload, "iat" | "exp"> = {
    subdealerId,
    phone,
    gstNumber,
  };

  // Subdealer tokens expire in 7 days
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
  } as jwt.SignOptions);
}

export function verifySubdealerToken(token: string): SubdealerJWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SubdealerJWTPayload;

    // Validate that this is a subdealer token (has subdealerId)
    if (!decoded.subdealerId) {
      throw new Error("Invalid subdealer token");
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid token");
    } else if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Token expired");
    } else {
      throw new Error("Token verification failed");
    }
  }
}

// Multi-factor tokens: issued once a password check succeeds, and exchanged
// for a real session token by the OTP step. Holding one proves the password
// was already verified, so the OTP endpoints never take a raw email.
export interface MfaTokenPayload {
  userId: number;
  purpose: "mfa";
  iat?: number;
  exp?: number;
}

export function generateMfaToken(
  userId: number,
  expiresIn: string = "10m"
): string {
  // Deliberately identifies the account only. It used to also carry the id of
  // the code it was issued alongside, which nothing ever read: verification
  // redeems whichever code is currently outstanding for the user, so naming
  // one in the token implied a binding that did not exist.
  const payload: Omit<MfaTokenPayload, "iat" | "exp"> = {
    userId,
    purpose: "mfa",
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as SignOptions);
}

export function verifyMfaToken(token: string): MfaTokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as MfaTokenPayload;
  if (decoded.purpose !== "mfa") {
    throw new Error("Invalid MFA token scope");
  }
  return decoded;
}
