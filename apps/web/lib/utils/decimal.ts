export type DecimalLike = string | number | null | undefined;

export function toNumber(value: DecimalLike, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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

let activeCurrency = "INR";

export function setActiveCurrency(code: string) {
  if (code) activeCurrency = code;
}

export function getActiveCurrency(): string {
  return activeCurrency;
}

const symbolCache = new Map<string, string>();

export function currencySymbol(
  code: string | null | undefined,
  fallback?: string | null
): string {
  if (!code) return fallback ?? "";
  const cached = symbolCache.get(code);
  if (cached !== undefined) return cached;

  let resolved: string;
  try {
    resolved =
      new Intl.NumberFormat("en", {
        style: "currency",
        currency: code,
        currencyDisplay: "symbol",
      })
        .formatToParts(1)
        .find(part => part.type === "currency")?.value ?? code;
  } catch {
    resolved = fallback ?? code;
  }

  symbolCache.set(code, resolved);
  return resolved;
}

export function distinctCurrencySymbol(
  code: string | null | undefined,
  fallback?: string | null
): string {
  const symbol = currencySymbol(code, fallback);
  return symbol === code ? "" : symbol;
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

export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
