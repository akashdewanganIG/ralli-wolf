export interface ParsedPhone {
  countryCode: string;
  localNumber: string;
}

export function parsePhoneNumber(
  phone: string | null | undefined,
  defaultCountryCode: string = "91"
): ParsedPhone | null {
  if (!phone || typeof phone !== "string") {
    return null;
  }

  const trimmed = phone.trim();

  if (trimmed.startsWith("+91")) {
    return {
      countryCode: "91",
      localNumber: trimmed.slice(3),
    };
  }

  if (trimmed.startsWith("91") && trimmed.length === 12) {
    return {
      countryCode: "91",
      localNumber: trimmed.slice(2),
    };
  }

  if (/^[6-9]\d{9}$/.test(trimmed)) {
    return {
      countryCode: defaultCountryCode,
      localNumber: trimmed,
    };
  }

  return null;
}

export function formatPhoneNumber(
  countryCode: string | null,
  localNumber: string | null
): string {
  if (!localNumber) {
    return "";
  }
  const code = countryCode || "91";
  return `${code}${localNumber}`;
}
