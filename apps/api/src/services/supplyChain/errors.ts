/**
 * Errors raised by the supply-chain services when a business rule is broken.
 * Controllers translate these into HTTP responses; anything else that escapes
 * a service is a genuine bug and becomes a 500.
 */
export class DomainError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    message: string,
    options?: { status?: number; code?: string; details?: unknown }
  ) {
    super(message);
    this.name = "DomainError";
    this.status = options?.status ?? 400;
    this.code = options?.code ?? "DOMAIN_ERROR";
    this.details = options?.details;
  }
}

export class InsufficientStockError extends DomainError {
  constructor(
    message: string,
    details: {
      productId: number;
      productCode?: string;
      warehouseId: number;
      requested: string;
      available: string;
      shortfall: string;
    }
  ) {
    super(message, { status: 409, code: "INSUFFICIENT_STOCK", details });
    this.name = "InsufficientStockError";
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super(`${resource} not found`, { status: 404, code: "NOT_FOUND" });
    this.name = "NotFoundError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, { status: 409, code: "CONFLICT", details });
    this.name = "ConflictError";
  }
}
