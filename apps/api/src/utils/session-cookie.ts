import type { Request, Response } from "express";

const DEVELOPMENT_COOKIE = "ralli_wolf_session";
const PRODUCTION_COOKIE = "__Host-ralli_wolf_session";

export function staffSessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? PRODUCTION_COOKIE
    : DEVELOPMENT_COOKIE;
}

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    return value || null;
  }
  return null;
}

export function staffSessionToken(req: Request): string | null {
  const authorization = req.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim() || null;
  }
  return cookieValue(req.get("cookie"), staffSessionCookieName());
}

export function setStaffSessionCookie(res: Response, token: string): void {
  res.cookie(staffSessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
  res.setHeader("Cache-Control", "no-store");
}

export function clearStaffSessionCookie(res: Response): void {
  res.clearCookie(staffSessionCookieName(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
  res.setHeader("Cache-Control", "no-store");
}

export function bearerSessionResponse(
  req: Request,
  token: string,
  field: "token" | "sessionToken" = "token"
): Partial<Record<"token" | "sessionToken", string>> {
  return req.get("x-session-mode")?.toLowerCase() === "bearer"
    ? { [field]: token }
    : {};
}
