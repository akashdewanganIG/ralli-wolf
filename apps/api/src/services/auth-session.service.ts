import type { Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { generateToken } from "../utils/jwt.utils.js";
import { recordAuditLog } from "../utils/audit.utils.js";
import {
  clearFailedAttempts,
  describeRequest,
  notifySuccessfulLogin,
} from "./login-security.service.js";
import {
  bearerSessionResponse,
  setStaffSessionCookie,
} from "../utils/session-cookie.js";
import type { AuthMethod } from "./auth-methods.service.js";

export interface StaffSessionUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
  role: UserRole;
  permissions: string[];
  mustChangePassword: boolean;
  sessionVersion: number;
}

const loginAuditActions: Record<AuthMethod, string> = {
  password: "LOGIN_WITH_PASSWORD",
  email: "LOGIN_WITH_EMAIL_OTP",
  totp: "LOGIN_WITH_AUTHENTICATOR",
};

export async function completeStaffSignIn(
  req: Request,
  res: Response,
  user: StaffSessionUser,
  via: AuthMethod
) {
  const token = generateToken(user.id, user.email, {
    sessionVersion: user.sessionVersion,
  });
  setStaffSessionCookie(res, token);
  clearFailedAttempts(user.id);
  notifySuccessfulLogin(user, describeRequest(req));
  await recordAuditLog({
    action: loginAuditActions[via],
    changedBy: user.id,
    entityType: "USER_AUTH",
    entityId: user.id,
    oldValues: null,
    newValues: null,
  });

  return res.json({
    mfaRequired: false,
    ...bearerSessionResponse(req, token),
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      role: user.role,
      permissions: user.permissions,
      mustChangePassword: user.mustChangePassword,
    },
  });
}
