/**
 * Parse phone number and extract country code and local number
 * Supports formats:
 * - +919876543210 -> { countryCode: '91', localNumber: '9876543210' }
 * - 919876543210 -> { countryCode: '91', localNumber: '9876543210' }
 * - 9876543210 -> { countryCode: '91', localNumber: '9876543210' }
 */
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

  // Check if it starts with +91
  if (trimmed.startsWith("+91")) {
    return {
      countryCode: "91",
      localNumber: trimmed.slice(3), // Remove +91
    };
  }

  // Check if it starts with 91 (without +)
  if (trimmed.startsWith("91") && trimmed.length === 12) {
    return {
      countryCode: "91",
      localNumber: trimmed.slice(2), // Remove 91
    };
  }

  // Plain 10-digit number - add default country code
  if (/^[6-9]\d{9}$/.test(trimmed)) {
    return {
      countryCode: defaultCountryCode,
      localNumber: trimmed,
    };
  }

  // If doesn't match any pattern, return null
  return null;
}

/**
 * Format phone number for display with country code (without +)
 */
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
