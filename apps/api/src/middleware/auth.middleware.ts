import { Request, Response, NextFunction } from "express";
import { prisma } from "@repo/db";
import {
  hashBearerToken,
  verifyToken,
  JWTPayload,
} from "../utils/jwt.utils.js";
import { UserRole } from "@prisma/client";
import { roleHasPermission, type Permission } from "@repo/db/permissions";
import { timingSafeEqual } from "node:crypto";
import {
  clearStaffSessionCookie,
  staffSessionToken,
} from "../utils/session-cookie.js";

function sameToken(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        firstName: string | null;
        lastName: string | null;
        role: UserRole;

        permissions: string[];
      };
      subdealer?: {
        id: number;
        phone: string;
        gstNumber: string;
      };
      salesUser?: {
        userId: number;
        phone: string;
        email: string;
        type: "sales_user";
      };
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = staffSessionToken(req);
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const decoded: JWTPayload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (
      !user ||
      user.deletedAt ||
      user.sessionVersion !== decoded.sessionVersion
    ) {
      clearStaffSessionCookie(res);
      return res.status(401).json({ error: "User not found" });
    }

    const originalUrl = req.originalUrl || "";

    if (user.mustChangePassword) {
      const passwordChangeRoutes = [
        "/api/auth/change-password",
        "/api/auth/me",
        "/api/auth/logout",
      ];
      const isPasswordChangeRoute = passwordChangeRoutes.some(route =>
        originalUrl.startsWith(route)
      );

      if (!isPasswordChangeRoute) {
        return res.status(403).json({
          error: "Set a new password before continuing",
          code: "PASSWORD_CHANGE_REQUIRED",
        });
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as UserRole,
      permissions: user.permissions ?? [],
    };

    next();
  } catch (error) {
    clearStaffSessionCookie(res);
    if (error instanceof Error) {
      return res.status(401).json({ error: error.message });
    }
    return res.status(401).json({ error: "Authentication failed" });
  }
}

export async function requireSubdealerAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access token required" });
    }

    const token = authHeader.substring(7);

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    const { verifySubdealerToken } = await import("../utils/jwt.utils.js");
    const decoded = verifySubdealerToken(token);

    const subdealer = await prisma.subdealer.findUnique({
      where: { id: decoded.subdealerId },
    });

    if (!subdealer) {
      return res.status(401).json({ error: "Subdealer not found" });
    }
    if (
      !subdealer.jwtTokenHash ||
      !sameToken(subdealer.jwtTokenHash, hashBearerToken(token))
    ) {
      return res.status(401).json({ error: "Session has been revoked" });
    }

    req.subdealer = {
      id: subdealer.id,
      phone: subdealer.phone,
      gstNumber: subdealer.gstNumber,
    };

    next();
  } catch (error) {
    if (error instanceof Error) {
      return res.status(401).json({ error: error.message });
    }
    return res.status(401).json({ error: "Authentication failed" });
  }
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!roleHasPermission(req.user.role, req.user.permissions, permission)) {
      return res.status(403).json({
        error: "You do not have permission to perform this action",
        code: "PERMISSION_DENIED",
        requiredPermission: permission,
      });
    }
    next();
  };
}
