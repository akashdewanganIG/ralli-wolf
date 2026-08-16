import { Prisma } from "@prisma/client";
import { DomainError } from "./errors.js";

export type DecimalInput = Prisma.Decimal | number | string;

export const ZERO = new Prisma.Decimal(0);

/**
 * Every quantity and money value that crosses the API boundary goes through
 * here. `Number` is never used for stock arithmetic — binary floating point
 * loses cents and fractional units, and an inventory ledger that does not
 * reconcile to the penny is worthless.
 */
export function toDecimal(
  value: DecimalInput | null | undefined,
  field = "value"
): Prisma.Decimal {
  if (value === null || value === undefined || value === "") {
    throw new DomainError(`${field} is required`, { code: "VALIDATION_ERROR" });
  }
  try {
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

export function requirePositive(
  value: DecimalInput,
  field: string
): Prisma.Decimal {
  const decimal = toDecimal(value, field);
  if (decimal.lessThanOrEqualTo(0)) {
    throw new DomainError(`${field} must be greater than zero`, {
      code: "VALIDATION_ERROR",
    });
  }
  return decimal;
}

export function requireNonNegative(
  value: DecimalInput,
  field: string
): Prisma.Decimal {
  const decimal = toDecimal(value, field);
  if (decimal.isNegative()) {
    throw new DomainError(`${field} cannot be negative`, {
      code: "VALIDATION_ERROR",
    });
  }
  return decimal;
}

/** Quantities are stored with 4 decimal places; round consistently. */
export function roundQuantity(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

/** Unit costs are stored with 4 decimal places. */
export function roundCost(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

/** Document totals are stored with 2 decimal places. */
export function roundMoney(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function sum(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((acc, value) => acc.plus(value), ZERO);
}

/** Percentage of `part` within `whole`, expressed 0–100, safe when whole is 0. */
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
