import { Request, Response, NextFunction } from "express";
import { prisma } from "@repo/db";
import { verifyToken, JWTPayload } from "../utils/jwt.utils.js";
import { UserRole } from "@prisma/client";
import { roleHasPermission, type Permission } from "@repo/db/permissions";

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        firstName: string | null;
        lastName: string | null;
        role: UserRole;
        /** Raw stored list; only meaningful for the CUSTOM role. */
        permissions: string[];
        isDeveloper?: boolean;
      };
      subdealer?: {
        id: number;
        phone: string;
        gstNumber: string;
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
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access token required" });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    // Verify the token
    const decoded: JWTPayload = verifyToken(token);

    // Fetch user details from database (get role only)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Developer account enforcement
    const originalUrl = req.originalUrl || "";

    if (decoded.isDeveloper) {
      const allowedPrefixes = [
        "/api/integrations",
        "/api/auth/logout",
        "/api/auth/me",
      ];
      const isAllowed = allowedPrefixes.some(prefix =>
        originalUrl.startsWith(prefix)
      );

      if (!isAllowed) {
        return res.status(403).json({
          error:
            "Developer access is restricted to integration management endpoints",
        });
      }
    }

    // If the authenticated user is the developer account but token is not developer-scoped, block access
    const developerEmail = process.env.DEVELOPER_LOGIN_EMAIL?.trim();
    const developerName =
      process.env.DEVELOPER_LOGIN_NAME?.trim() || "Developer Access";
    const userFullName =
      `${user.firstName || ""} ${user.lastName || ""}`.trim();
    const isDeveloperAccount =
      (!!developerEmail &&
        user.email.toLowerCase() === developerEmail.toLowerCase()) ||
      (user.role === UserRole.ADMIN &&
        userFullName.toLowerCase() === developerName.toLowerCase());
    if (isDeveloperAccount && !decoded.isDeveloper) {
      return res
        .status(403)
        .json({ error: "Developer must use developer login" });
    }

    // An account still on its emailed password can do nothing but replace it.
    // Enforced here rather than in the client so the token is useless against
    // the API directly.
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
      isDeveloper: !!decoded.isDeveloper,
    };

    next();
  } catch (error) {
    if (error instanceof Error) {
      return res.status(401).json({ error: error.message });
    }
    return res.status(401).json({ error: "Authentication failed" });
  }
}

// Subdealer authentication middleware
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

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    // Verify the token using subdealer verification
    const { verifySubdealerToken } = await import("../utils/jwt.utils.js");
    const decoded = verifySubdealerToken(token);

    // Verify subdealer exists and is active (optional but recommended)
    const subdealer = await prisma.subdealer.findUnique({
      where: { id: decoded.subdealerId },
    });

    if (!subdealer) {
      return res.status(401).json({ error: "Subdealer not found" });
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

// New role-based middleware
type UserRoleType = UserRole;
export function requireRole(allowedRoles: UserRoleType[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    // A CUSTOM account has no fixed rank, so a role list cannot describe it.
    // It passes when its own permission set covers what the route needs, which
    // is why role-gated routes name a permission alongside the roles.
    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "Insufficient role to access this resource" });
    }
    next();
  };
}

/**
 * Gate a route on a capability rather than a rank.
 *
 * ADMIN passes everything, SALES passes its default set, and CUSTOM passes on
 * the permissions an admin granted it. Prefer this over `requireRole` for
 * anything a CUSTOM user could legitimately be given.
 */
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

export function requireDeveloper(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!req.user.isDeveloper) {
    return res.status(403).json({ error: "Developer access required" });
  }

  next();
}

/**
 * Middleware to validate ADMIN-SECRET from environment variable
 * Accepts secret from header (x-admin-secret) or request body (adminSecret)
 */
export function requireAdminSecret(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return res.status(500).json({
      error:
        "Admin secret not configured. Please set ADMIN_SECRET environment variable.",
    });
  }

  // Check header first (x-admin-secret), then body (adminSecret)
  const providedSecret =
    (req.headers["x-admin-secret"] as string) || req.body?.adminSecret;

  if (!providedSecret) {
    return res.status(401).json({
      error:
        "Admin secret required. Provide it via x-admin-secret header or adminSecret in request body.",
    });
  }

  if (providedSecret !== adminSecret) {
    return res.status(403).json({
      error: "Invalid admin secret",
    });
  }

  next();
}
