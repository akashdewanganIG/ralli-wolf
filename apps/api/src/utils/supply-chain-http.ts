import { Request, Response } from "express";
import { DomainError } from "../services/supplyChain/errors.js";
import { handleError } from "./error-handler.js";
import {
  parseBoundedInteger,
  parseIsoDate,
  parsePositiveInteger,
} from "./validators.js";

export function handleSupplyChainError(
  error: unknown,
  res: Response,
  operation: string
): void {
  if (error instanceof DomainError) {
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
  const page =
    req.query.page === undefined
      ? 1
      : parseBoundedInteger(req.query.page, 1, 1_000_000);
  const limit =
    req.query.limit === undefined
      ? defaultLimit
      : parseBoundedInteger(req.query.limit, 1, maxLimit);
  if (page === null || limit === null) {
    throw new DomainError(
      `page must be positive and limit must be between 1 and ${maxLimit}`,
      { code: "VALIDATION_ERROR" }
    );
  }
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

export function parseId(value: string | undefined, label: string): number {
  const parsed = parsePositiveInteger(value);
  if (parsed === null) {
    throw new DomainError(`${label} must be a valid id`, {
      code: "VALIDATION_ERROR",
    });
  }
  return parsed;
}

export function parseOptionalId(value: unknown, label = "id"): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = parsePositiveInteger(value);
  if (parsed === null) {
    throw new DomainError(`${label} must be a valid id`, {
      code: "VALIDATION_ERROR",
    });
  }
  return parsed;
}

export function parseInteger(
  value: unknown,
  label: string,
  minimum = 0,
  maximum = 1_000_000
): number {
  const parsed = parseBoundedInteger(value, minimum, maximum);
  if (parsed === null) {
    throw new DomainError(
      `${label} must be an integer between ${minimum} and ${maximum}`,
      { code: "VALIDATION_ERROR" }
    );
  }
  return parsed;
}

export function parseOptionalInteger(
  value: unknown,
  label: string,
  minimum = 0,
  maximum = 1_000_000
): number | null {
  if (value === undefined || value === null || value === "") return null;
  return parseInteger(value, label, minimum, maximum);
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

export function parseDate(value: unknown, label: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = parseIsoDate(value);
  if (!parsed) {
    throw new DomainError(`${label} must be a valid date`, {
      code: "VALIDATION_ERROR",
    });
  }
  return parsed;
}

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

export function requireString(
  value: unknown,
  field: string,
  maximumLength = 5_000
): string {
  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    value.trim().length > maximumLength
  ) {
    throw new DomainError(`${field} is required`, { code: "VALIDATION_ERROR" });
  }
  return value.trim();
}

export function optionalString(
  value: unknown,
  field = "value",
  maximumLength = 5_000
): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new DomainError(`${field} must be text`, {
      code: "VALIDATION_ERROR",
    });
  }
  const trimmed = value.trim();
  if (trimmed.length > maximumLength) {
    throw new DomainError(
      `${field} must not exceed ${maximumLength} characters`,
      { code: "VALIDATION_ERROR" }
    );
  }
  return trimmed === "" ? null : trimmed;
}

export function requireNumber(value: unknown, field: string): number {
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || !/^-?(?:\d+|\d*\.\d+)$/.test(value.trim()))
  ) {
    throw new DomainError(`${field} must be a number`, {
      code: "VALIDATION_ERROR",
    });
  }
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
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new DomainError(`${field} must be one of: ${allowed.join(", ")}`, {
      code: "VALIDATION_ERROR",
    });
  }
  return value as T[keyof T];
}

export function parseEnumList<T extends Record<string, string>>(
  enumObject: T,
  value: unknown,
  field: string
): Array<T[keyof T]> {
  if (value === undefined || value === null || value === "") return [];
  if (typeof value !== "string") {
    throw new DomainError(`${field} must be a comma-separated string`, {
      code: "VALIDATION_ERROR",
    });
  }
  const parts = value
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);
  if (parts.length > 50) {
    throw new DomainError(`${field} cannot contain more than 50 values`, {
      code: "VALIDATION_ERROR",
    });
  }
  return parts.map(
    part => parseEnum(enumObject, part, field, true) as T[keyof T]
  );
}

export function requireArray<T>(value: unknown, field: string): T[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 1_000) {
    throw new DomainError(`${field} must be a non-empty array`, {
      code: "VALIDATION_ERROR",
    });
  }
  return value as T[];
}
