/**
 * Format a phone number with country code
 * @param phone - The phone number
 * @param countryCode - The country code (with or without +)
 * @returns Formatted phone number with country code
 */
export function formatPhoneWithCountryCode(
  phone?: string | null,
  countryCode?: string | null
): string {
  if (!phone) return "No phone provided";

  // Default country code is 91 (India)
  let code = countryCode || "91";

  // Remove + if it already exists in the country code
  code = code.replace(/^\+/, "");

  return `+${code} ${phone}`;
}

/**
 * Format a phone number display with country code
 * @param phone - The phone number
 * @param countryCode - The country code (with or without +)
 * @returns Formatted phone number or fallback text
 */
export function displayPhone(
  phone?: string | null,
  countryCode?: string | null
): string {
  if (!phone) return "N/A";

  // Default country code is 91 (India)
  let code = countryCode || "91";

  // Remove + if it already exists in the country code
  code = code.replace(/^\+/, "");

  return `+${code} ${phone}`;
}
