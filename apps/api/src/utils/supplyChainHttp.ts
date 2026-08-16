import { Request, Response } from "express";
import { DomainError } from "../services/supplyChain/errors.js";
import { handleError } from "./errorHandler.js";

/**
 * Map a service-layer business-rule failure onto its HTTP status, and let
 * anything else fall through to the existing Prisma/server error handler.
 */
export function handleSupplyChainError(
  error: unknown,
  res: Response,
  operation: string
): void {
  if (error instanceof DomainError) {
    console.error(`${error.name} in ${operation}:`, {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    res.status(error.status).json({
      error: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }
  handleError(error, res, operation);
}

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export function parsePagination(
  req: Request,
  defaultLimit = 25,
  maxLimit = 200
): Pagination {
  const page = Math.max(1, parseInt(String(req.query.page ?? ""), 10) || 1);
  const requested = parseInt(String(req.query.limit ?? ""), 10);
  const limit =
    requested >= 1 && requested <= maxLimit ? requested : defaultLimit;
  return { page, limit, skip: (page - 1) * limit };
}

export function paginationMeta(totalItems: number, pagination: Pagination) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pagination.limit));
  return {
    currentPage: pagination.page,
    totalPages,
    totalItems,
    itemsPerPage: pagination.limit,
    hasNextPage: pagination.page < totalPages,
    hasPreviousPage: pagination.page > 1,
  };
}

/** Parse a route parameter that must be a positive integer id. */
export function parseId(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new DomainError(`${label} must be a valid id`, {
      code: "VALIDATION_ERROR",
    });
  }
  return parsed;
}

/** Parse an optional numeric query parameter. */
export function parseOptionalId(value: unknown, label = "id"): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new DomainError(`${label} must be a valid id`, {
      code: "VALIDATION_ERROR",
    });
  }
  return parsed;
}

export function parseBoolean(
  value: unknown,
  label = "value"
): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  throw new DomainError(`${label} must be true or false`, {
    code: "VALIDATION_ERROR",
  });
}

/** Parse an ISO date from a query string or body field. */
export function parseDate(value: unknown, label: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new DomainError(`${label} must be a valid date`, {
      code: "VALIDATION_ERROR",
    });
  }
  return parsed;
}

/**
 * Reporting windows default to the last 30 days when the caller does not give
 * one, which keeps a bare dashboard request cheap without hiding the choice.
 */
export function parseDateRange(
  req: Request,
  defaultDays = 30
): { from: Date; to: Date } {
  const to = parseDate(req.query.to, "to") ?? new Date();
  const fromQuery = parseDate(req.query.from, "from");
  if (fromQuery) return { from: fromQuery, to };
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - defaultDays);
  return { from, to };
}

/** The authenticated user id, or a hard failure if the route was left open. */
export function requireUserId(req: Request): number {
  const userId = req.user?.id;
  if (!userId) {
    throw new DomainError("Authentication required", {
      status: 401,
      code: "UNAUTHORIZED",
    });
  }
  return userId;
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DomainError(`${field} is required`, { code: "VALIDATION_ERROR" });
  }
  return value.trim();
}

export function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function requireNumber(value: unknown, field: string): number {
  const parsed = Number(value);
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    !Number.isFinite(parsed)
  ) {
    throw new DomainError(`${field} must be a number`, {
      code: "VALIDATION_ERROR",
    });
  }
  return parsed;
}

/** Validate that a value is one of an enum's members. */
export function parseEnum<T extends Record<string, string>>(
  enumObject: T,
  value: unknown,
  field: string,
  required = false
): T[keyof T] | undefined {
  if (value === undefined || value === null || value === "") {
    if (required)
      throw new DomainError(`${field} is required`, {
        code: "VALIDATION_ERROR",
      });
    return undefined;
  }
  const allowed = Object.values(enumObject);
  if (!allowed.includes(String(value))) {
    throw new DomainError(`${field} must be one of: ${allowed.join(", ")}`, {
      code: "VALIDATION_ERROR",
    });
  }
  return value as T[keyof T];
}

/** Comma-separated query parameter into a validated enum array. */
export function parseEnumList<T extends Record<string, string>>(
  enumObject: T,
  value: unknown,
  field: string
): Array<T[keyof T]> {
  if (value === undefined || value === null || value === "") return [];
  const parts = String(value)
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);
  return parts.map(
    part => parseEnum(enumObject, part, field, true) as T[keyof T]
  );
}

export function requireArray<T>(value: unknown, field: string): T[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new DomainError(`${field} must be a non-empty array`, {
      code: "VALIDATION_ERROR",
    });
  }
  return value as T[];
}
