import { Response } from "express";
import { Prisma } from "@prisma/client";
import { logError } from "./logger.js";

export interface ErrorResponse {
  error: string;
  details?: string;
  code?: string;
  field?: string;
  fields?: string[];
}

export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
  INVALID_FORMAT = "INVALID_FORMAT",

  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",

  ACCOUNT_DEACTIVATED = "ACCOUNT_DEACTIVATED",

  MFA_SESSION_EXPIRED = "MFA_SESSION_EXPIRED",
  INVALID_OTP = "INVALID_OTP",
  OTP_EXPIRED = "OTP_EXPIRED",
  OTP_ATTEMPTS_EXCEEDED = "OTP_ATTEMPTS_EXCEEDED",
  OTP_DELIVERY_FAILED = "OTP_DELIVERY_FAILED",

  NOT_FOUND = "NOT_FOUND",
  ALREADY_EXISTS = "ALREADY_EXISTS",
  CONFLICT = "CONFLICT",

  DATABASE_ERROR = "DATABASE_ERROR",
  FOREIGN_KEY_CONSTRAINT = "FOREIGN_KEY_CONSTRAINT",
  UNIQUE_CONSTRAINT = "UNIQUE_CONSTRAINT",

  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

export function handlePrismaError(
  error: Prisma.PrismaClientKnownRequestError,
  res: Response,
  context: string = "Operation"
): void {
  if (error.code === "P2002") {
    res.status(409).json({
      error: `${context} conflicts with existing data`,
      code: ErrorCode.UNIQUE_CONSTRAINT,
    } as ErrorResponse);
    return;
  }

  if (error.code === "P2025") {
    res.status(404).json({
      error: `${context} failed: Record not found`,
      code: ErrorCode.NOT_FOUND,
    } as ErrorResponse);
    return;
  }

  if (error.code === "P2003") {
    res.status(400).json({
      error: `${context} failed: Invalid reference`,
      code: ErrorCode.FOREIGN_KEY_CONSTRAINT,
    } as ErrorResponse);
    return;
  }

  if (error.code === "P2014") {
    res.status(400).json({
      error: `${context} failed: Invalid relationship`,
      code: ErrorCode.VALIDATION_ERROR,
    } as ErrorResponse);
    return;
  }

  logError("database_operation_failed", error, {
    operation: context,
    prismaCode: error.code,
  });
  res.status(500).json({
    error: `${context} failed due to database error`,
    code: ErrorCode.DATABASE_ERROR,
  } as ErrorResponse);
}

export function handleValidationError(
  res: Response,
  message: string,
  field?: string,
  _context: string = "Operation"
): void {
  res.status(400).json({
    error: message,
    code: ErrorCode.VALIDATION_ERROR,
    field,
  } as ErrorResponse);
}

export function handleUnauthorizedError(
  res: Response,
  message: string = "Authentication required",
  _context: string = "Operation",
  code: ErrorCode = ErrorCode.UNAUTHORIZED,
  details?: Record<string, unknown>
): void {
  res.status(401).json({
    error: message,
    code,
    ...details,
  } as ErrorResponse);
}

export function handleForbiddenError(
  res: Response,
  message: string = "You do not have permission to perform this action",
  _context: string = "Operation"
): void {
  res.status(403).json({
    error: message,
    code: ErrorCode.FORBIDDEN,
  } as ErrorResponse);
}

export function handleNotFoundError(
  res: Response,
  resource: string,
  _context: string = "Operation"
): void {
  res.status(404).json({
    error: `${resource} not found`,
    code: ErrorCode.NOT_FOUND,
  } as ErrorResponse);
}

export function handleConflictError(
  res: Response,
  message: string,
  _context: string = "Operation"
): void {
  res.status(409).json({
    error: message,
    code: ErrorCode.CONFLICT,
  } as ErrorResponse);
}

export function handleServerError(
  error: unknown,
  res: Response,
  context: string = "Operation"
): void {
  logError("server_operation_failed", error, { operation: context });

  res.status(500).json({
    error: `${context} failed due to an internal error`,
    details: "Please try again later",
    code: ErrorCode.INTERNAL_ERROR,
  } as ErrorResponse);
}

export function handleError(
  error: unknown,
  res: Response,
  context: string = "Operation"
): void {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    handlePrismaError(error, res, context);
    return;
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      error: `${context} failed: Invalid data provided`,
      details: "Please check your input",
      code: ErrorCode.VALIDATION_ERROR,
    } as ErrorResponse);
    return;
  }

  handleServerError(error, res, context);
}

export function validateRequiredFields(
  body: unknown,
  requiredFields: readonly string[],
  res: Response,
  _context: string = "Operation"
): boolean {
  const missingFields: string[] = [];

  const record =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  for (const field of requiredFields) {
    const present =
      record && Object.prototype.hasOwnProperty.call(record, field);
    const value = present ? record[field] : undefined;
    if (
      !present ||
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "")
    ) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    res.status(400).json({
      error: `Missing required fields: ${missingFields.join(", ")}`,
      code: ErrorCode.MISSING_REQUIRED_FIELD,
      fields: missingFields,
    } as ErrorResponse);

    return false;
  }

  return true;
}
