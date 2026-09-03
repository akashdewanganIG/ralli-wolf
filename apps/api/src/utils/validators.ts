export function normalizeEmail(
  email: string | null | undefined
): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }
  const value = email.trim();
  if (value.length > 254) return false;
  const [local, domain, ...extra] = value.split("@");
  if (!local || !domain || extra.length || local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return false;
  }
  if (!/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;
  const labels = domain.split(".");
  return (
    labels.length >= 2 &&
    labels.every(
      label =>
        label.length >= 1 &&
        label.length <= 63 &&
        /^[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?$/i.test(label)
    ) &&
    labels[labels.length - 1]!.length >= 2
  );
}

export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone || typeof phone !== "string") {
    return false;
  }
  const trimmed = phone.trim();

  const digitsOnly = trimmed.replace(/\D/g, "");

  return /^\d{10}$/.test(digitsOnly);
}

export function isValidName(name: string | null | undefined): boolean {
  if (!name || typeof name !== "string") {
    return false;
  }
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 255;
}

export function isValidPincode(pincode: string | null | undefined): boolean {
  if (!pincode || typeof pincode !== "string") {
    return false;
  }
  const pincodeRegex = /^\d{6}$/;
  return pincodeRegex.test(pincode.trim());
}

export function normalizeHttpUrl(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length > 2048)
    throw new Error("URL cannot exceed 2048 characters");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("URL must be an absolute HTTP or HTTPS URL");
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      "URL must use HTTP or HTTPS and cannot contain embedded credentials"
    );
  }
  return parsed.toString();
}

export function validateFieldLength(
  field: string | null | undefined,
  maxLength: number
): boolean {
  if (!field || typeof field !== "string") {
    return true;
  }
  return field.trim().length <= maxLength;
}

export function parseBoundedInteger(
  value: unknown,
  minimum: number,
  maximum: number
): number | null {
  if (
    !Number.isSafeInteger(minimum) ||
    !Number.isSafeInteger(maximum) ||
    minimum > maximum
  ) {
    throw new Error("Integer bounds must be ordered safe integers");
  }
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = typeof value === "string" ? value.trim() : value;
  if (
    normalized === "" ||
    (typeof normalized === "string" && !/^-?\d+$/.test(normalized))
  ) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

export function parsePositiveInteger(value: unknown): number | null {
  return parseBoundedInteger(value, 1, Number.MAX_SAFE_INTEGER);
}

export function parseUniquePositiveIntegerArray(
  value: unknown,
  maximumItems = 500,
  maximumId = 2_147_483_647
): number[] | null {
  if (
    !Number.isSafeInteger(maximumItems) ||
    maximumItems < 1 ||
    !Number.isSafeInteger(maximumId) ||
    maximumId < 1 ||
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > maximumItems
  ) {
    return null;
  }
  const parsed: number[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    const id = parseBoundedInteger(item, 1, maximumId);
    if (id === null || seen.has(id)) return null;
    seen.add(id);
    parsed.push(id);
  }
  return parsed;
}

export interface PageRange {
  startPage: number;
  endPage: number;
  limit: number;
}

export function parsePageRange(
  startValue: unknown,
  endValue: unknown,
  limitValue: unknown,
  defaultLimit: number,
  maximumLimit: number
): PageRange | null {
  const startPage =
    startValue === undefined
      ? 1
      : parseBoundedInteger(startValue, 1, 1_000_000);
  if (startPage === null) return null;
  const endPage =
    endValue === undefined
      ? startPage
      : parseBoundedInteger(endValue, startPage, 1_000_000);
  const limit =
    limitValue === undefined
      ? defaultLimit
      : parseBoundedInteger(limitValue, 1, maximumLimit);
  if (endPage === null || limit === null) return null;
  return { startPage, endPage, limit };
}

export function parseStrictBoolean(value: unknown): boolean | null {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return null;
}

export function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
      normalized
    )
  ) {
    return null;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  if (
    !normalized.includes("T") &&
    parsed.toISOString().slice(0, 10) !== normalized
  ) {
    return null;
  }
  return parsed;
}

export function parsePositiveDecimal(
  value: unknown,
  maximumIntegerDigits = 12,
  maximumFractionDigits = 4
): string | null {
  if (
    !Number.isSafeInteger(maximumIntegerDigits) ||
    maximumIntegerDigits <= 0 ||
    !Number.isSafeInteger(maximumFractionDigits) ||
    maximumFractionDigits < 0
  ) {
    throw new Error("Decimal digit bounds are invalid");
  }
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  const decimalPattern = new RegExp(
    `^\\d{1,${maximumIntegerDigits}}${
      maximumFractionDigits > 0 ? `(?:\\.\\d{1,${maximumFractionDigits}})?` : ""
    }$`
  );
  if (!decimalPattern.test(normalized)) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric > 0 ? normalized : null;
}

export function parseNonNegativeDecimal(
  value: unknown,
  maximumIntegerDigits = 12,
  maximumFractionDigits = 4
): string | null {
  if (
    !Number.isSafeInteger(maximumIntegerDigits) ||
    maximumIntegerDigits <= 0 ||
    !Number.isSafeInteger(maximumFractionDigits) ||
    maximumFractionDigits < 0
  ) {
    throw new Error("Decimal digit bounds are invalid");
  }
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  const decimalPattern = new RegExp(
    `^\\d{1,${maximumIntegerDigits}}${
      maximumFractionDigits > 0 ? `(?:\\.\\d{1,${maximumFractionDigits}})?` : ""
    }$`
  );
  if (!decimalPattern.test(normalized)) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric >= 0 ? normalized : null;
}

export function isValidGstNumber(gst: string | null | undefined): boolean {
  if (!gst || typeof gst !== "string") {
    return false;
  }
  const trimmed = gst.trim().toUpperCase();

  const gstRegex = /^[0-9A-Z]{15}$/;
  return gstRegex.test(trimmed);
}

export function isValidNameForImport(name: string | null | undefined): boolean {
  if (!name || typeof name !== "string") {
    return false;
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return false;
  }

  return /[^0-9]/.test(trimmed);
}

export function isValidPhoneForImport(
  phone: string | null | undefined
): boolean {
  if (!phone || typeof phone !== "string") {
    return false;
  }
  const trimmed = phone.trim();

  const digitsOnly = trimmed.replace(/\D/g, "");

  return /^\d{10}$/.test(digitsOnly);
}

export function isValidEmailForImport(
  email: string | null | undefined
): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return false;
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(trimmed);
}

export function isValidPincodeForImport(
  pincode: string | null | undefined
): boolean {
  return isValidPincode(pincode);
}

export function isValidCompanyForImport(
  company: string | null | undefined
): boolean {
  if (!company || typeof company !== "string") {
    return true;
  }

  return company.trim().length > 0;
}
