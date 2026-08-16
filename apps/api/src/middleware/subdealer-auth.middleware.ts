import { Request, Response, NextFunction } from "express";
import { verifySubdealerToken } from "../utils/jwt.utils.js";
import { handleUnauthorizedError } from "../utils/errorHandler.js";

// Extend Express Request to include subdealer
declare global {
  namespace Express {
    interface Request {
      subdealer?: {
        id: number;
        phone: string;
        gstNumber: string;
      };
    }
  }
}

/**
 * Middleware to authenticate subdealer requests using JWT
 * Expects Authorization header with Bearer token
 */
export function authenticateSubdealer(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return handleUnauthorizedError(
        res,
        "No token provided. Please login first.",
        "Authenticate Subdealer"
      );
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifySubdealerToken(token);

    // Attach subdealer info to request (map subdealerId to id)
    req.subdealer = {
      id: decoded.subdealerId,
      phone: decoded.phone,
      gstNumber: decoded.gstNumber,
    };

    // Continue to next middleware/route handler
    next();
  } catch (error: any) {
    const message = error?.message || "Invalid or expired token";
    return handleUnauthorizedError(res, message, "Authenticate Subdealer");
  }
}
