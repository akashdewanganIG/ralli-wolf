import { Prisma } from "@prisma/client";
import { DomainError } from "./errors.js";

export type DecimalInput = Prisma.Decimal | number | string;

export const ZERO = new Prisma.Decimal(0);

export function toDecimal(
  value: DecimalInput | null | undefined,
  field = "value"
): Prisma.Decimal {
  if (value === null || value === undefined || value === "") {
    throw new DomainError(`${field} is required`, { code: "VALIDATION_ERROR" });
  }
  try {
    if (!Prisma.Decimal.isDecimal(value)) {
      if (typeof value !== "string" && typeof value !== "number") {
        throw new Error("not numeric");
      }
      const normalized = String(value).trim();
      if (
        normalized.length > 64 ||
        !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized)
      ) {
        throw new Error("not a canonical decimal");
      }
    }
    const decimal = new Prisma.Decimal(value);
    if (!decimal.isFinite()) {
      throw new Error("not finite");
    }
    return decimal;
  } catch {
    throw new DomainError(`${field} must be a valid number`, {
      code: "VALIDATION_ERROR",
    });
  }
}

export function toDecimalOr(
  value: DecimalInput | null | undefined,
  fallback: Prisma.Decimal
): Prisma.Decimal {
  if (value === null || value === undefined || value === "") return fallback;
  return toDecimal(value);
}

export function requirePositive(value: unknown, field: string): Prisma.Decimal {
  const decimal = toDecimal(value as DecimalInput, field);
  if (decimal.lessThanOrEqualTo(0)) {
    throw new DomainError(`${field} must be greater than zero`, {
      code: "VALIDATION_ERROR",
    });
  }
  return decimal;
}

export function requireNonNegative(
  value: unknown,
  field: string
): Prisma.Decimal {
  const decimal = toDecimal(value as DecimalInput, field);
  if (decimal.isNegative()) {
    throw new DomainError(`${field} cannot be negative`, {
      code: "VALIDATION_ERROR",
    });
  }
  return decimal;
}

export function requirePercentage(
  value: unknown,
  field: string
): Prisma.Decimal {
  const decimal = requireNonNegative(value, field);
  if (decimal.greaterThan(100)) {
    throw new DomainError(`${field} cannot exceed 100`, {
      code: "VALIDATION_ERROR",
    });
  }
  return decimal;
}

export function roundQuantity(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

export function roundCost(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

export function roundMoney(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function sum(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((acc, value) => acc.plus(value), ZERO);
}

export function percentageOf(
  part: Prisma.Decimal,
  whole: Prisma.Decimal
): Prisma.Decimal {
  if (whole.isZero()) return ZERO;
  return part
    .dividedBy(whole)
    .times(100)
    .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}
