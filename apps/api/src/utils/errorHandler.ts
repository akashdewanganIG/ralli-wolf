import { Response } from "express";
import { Prisma } from "@prisma/client";

/**
 * Standardized Error Response Format
 */
export interface ErrorResponse {
  error: string; // User-friendly message
  details?: string; // Technical details
  code?: string; // Error code
  field?: string; // Field name for validation errors
  fields?: string[]; // Multiple fields for validation errors
}

/**
 * Error codes for consistent error handling
 */
export enum ErrorCode {
  // Validation
  VALIDATION_ERROR = "VALIDATION_ERROR",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
  INVALID_FORMAT = "INVALID_FORMAT",

  // Authentication & Authorization
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",

  // Resources
  NOT_FOUND = "NOT_FOUND",
  ALREADY_EXISTS = "ALREADY_EXISTS",
  CONFLICT = "CONFLICT",

  // Database
  DATABASE_ERROR = "DATABASE_ERROR",
  FOREIGN_KEY_CONSTRAINT = "FOREIGN_KEY_CONSTRAINT",
  UNIQUE_CONSTRAINT = "UNIQUE_CONSTRAINT",

  // Server
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

/**
 * Handle Prisma errors and convert to appropriate HTTP responses
 */
export function handlePrismaError(
  error: any,
  res: Response,
  context: string = "Operation"
): void {
  console.error(`Prisma Error in ${context}:`, {
    code: error.code,
    message: error.message,
    meta: error.meta,
  });

  // P2002: Unique constraint violation
  if (error.code === "P2002") {
    const target = error.meta?.target || [];
    const field = Array.isArray(target) ? target[0] : "field";

    res.status(409).json({
      error: `${context} failed: A record with this ${field} already exists`,
      details: `Unique constraint violation on ${field}`,
      code: ErrorCode.UNIQUE_CONSTRAINT,
      field,
    } as ErrorResponse);
    return;
  }

  // P2025: Record not found
  if (error.code === "P2025") {
    res.status(404).json({
      error: `${context} failed: Record not found`,
      details: error.meta?.cause || "The requested record does not exist",
      code: ErrorCode.NOT_FOUND,
    } as ErrorResponse);
    return;
  }

  // P2003: Foreign key constraint violation
  if (error.code === "P2003") {
    const field = error.meta?.field_name || "reference";

    res.status(400).json({
      error: `${context} failed: Invalid reference`,
      details: `Foreign key constraint failed on ${field}`,
      code: ErrorCode.FOREIGN_KEY_CONSTRAINT,
      field,
    } as ErrorResponse);
    return;
  }

  // P2014: Invalid relation
  if (error.code === "P2014") {
    res.status(400).json({
      error: `${context} failed: Invalid relationship`,
      details: error.message,
      code: ErrorCode.VALIDATION_ERROR,
    } as ErrorResponse);
    return;
  }

  // Other Prisma errors - treat as database errors
  res.status(500).json({
    error: `${context} failed due to database error`,
    details:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Database operation failed",
    code: ErrorCode.DATABASE_ERROR,
  } as ErrorResponse);
}

/**
 * Handle validation errors
 */
export function handleValidationError(
  res: Response,
  message: string,
  field?: string,
  context: string = "Operation"
): void {
  console.error(`Validation Error in ${context}:`, { message, field });

  res.status(400).json({
    error: message,
    code: ErrorCode.VALIDATION_ERROR,
    field,
  } as ErrorResponse);
}

/**
 * Handle authorization errors
 */
export function handleUnauthorizedError(
  res: Response,
  message: string = "Authentication required",
  context: string = "Operation"
): void {
  console.error(`Unauthorized in ${context}:`, message);

  res.status(401).json({
    error: message,
    code: ErrorCode.UNAUTHORIZED,
  } as ErrorResponse);
}

/**
 * Handle forbidden errors
 */
export function handleForbiddenError(
  res: Response,
  message: string = "You do not have permission to perform this action",
  context: string = "Operation"
): void {
  console.error(`Forbidden in ${context}:`, message);

  res.status(403).json({
    error: message,
    code: ErrorCode.FORBIDDEN,
  } as ErrorResponse);
}

/**
 * Handle not found errors
 */
export function handleNotFoundError(
  res: Response,
  resource: string,
  context: string = "Operation"
): void {
  console.error(`Not Found in ${context}:`, resource);

  res.status(404).json({
    error: `${resource} not found`,
    code: ErrorCode.NOT_FOUND,
  } as ErrorResponse);
}

/**
 * Handle conflict errors
 */
export function handleConflictError(
  res: Response,
  message: string,
  context: string = "Operation"
): void {
  console.error(`Conflict in ${context}:`, message);

  res.status(409).json({
    error: message,
    code: ErrorCode.CONFLICT,
  } as ErrorResponse);
}

/**
 * Handle generic server errors
 */
export function handleServerError(
  error: any,
  res: Response,
  context: string = "Operation"
): void {
  console.error(`Server Error in ${context}:`, {
    name: error?.name,
    message: error?.message,
    stack: process.env.NODE_ENV === "development" ? error?.stack : undefined,
  });

  res.status(500).json({
    error: `${context} failed due to an internal error`,
    details:
      process.env.NODE_ENV === "development"
        ? error?.message
        : "Please try again later",
    code: ErrorCode.INTERNAL_ERROR,
  } as ErrorResponse);
}

/**
 * Main error handler - routes to appropriate handler
 */
export function handleError(
  error: any,
  res: Response,
  context: string = "Operation"
): void {
  // Check if it's a Prisma error
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    handlePrismaError(error, res, context);
    return;
  }

  // Check if it's a Prisma validation error
  if (error instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      error: `${context} failed: Invalid data provided`,
      details:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Please check your input",
      code: ErrorCode.VALIDATION_ERROR,
    } as ErrorResponse);
    return;
  }

  // Default to server error
  handleServerError(error, res, context);
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(
  body: any,
  requiredFields: string[],
  res: Response,
  context: string = "Operation"
): boolean {
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (!body[field]) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    console.error(`Missing required fields in ${context}:`, missingFields);

    res.status(400).json({
      error: `Missing required fields: ${missingFields.join(", ")}`,
      code: ErrorCode.MISSING_REQUIRED_FIELD,
      fields: missingFields,
    } as ErrorResponse);

    return false;
  }

  return true;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
