/**
 * Helpers for the decimal strings the supply-chain API returns.
 *
 * The API sends quantities and money as strings so nothing is lost in transit.
 * Converting to `number` is fine for *display* — no realistic stock figure
 * exceeds 2^53 — but never send a converted number back to the server for a
 * quantity or price; pass the original string through.
 */

export type DecimalLike = string | number | null | undefined;

export function toNumber(value: DecimalLike, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Trim trailing zeros so 12.5000 reads as 12.5 but 12.0000 reads as 12. */
export function formatQuantity(
  value: DecimalLike,
  maximumFractionDigits = 4
): string {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = toNumber(value);
  return parsed.toLocaleString(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });
}

/**
 * The currency every amount is shown in, unless a caller names one.
 *
 * A module-level value rather than a hook because `formatMoney` is a plain
 * function called from ~90 places — inside column definitions, inline in JSX,
 * and in helpers that are not components and cannot hold a subscription.
 * `CurrencyProvider` owns it and re-renders the tree when it changes, so this
 * is never read while stale.
 */
let activeCurrency = "INR";

/** Called by `CurrencyProvider`; not intended for use anywhere else. */
export function setActiveCurrency(code: string) {
  if (code) activeCurrency = code;
}

export function getActiveCurrency(): string {
  return activeCurrency;
}

export function formatMoney(
  value: DecimalLike,
  currency: string = activeCurrency
): string {
  if (value === null || value === undefined || value === "") return "—";
  try {
    return toNumber(value).toLocaleString(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    });
  } catch {
    // An unknown ISO code should not blank out the figure.
    return `${currency} ${toNumber(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
}

export function formatPercent(value: DecimalLike, fractionDigits = 1): string {
  if (value === null || value === undefined || value === "") return "—";
  return `${toNumber(value).toFixed(fractionDigits)}%`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Days from now until `value`; negative when the date has passed. */
export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

/** Turn SCREAMING_SNAKE_CASE enum values into readable labels. */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
