export function formatPhoneWithCountryCode(
  phone?: string | null,
  countryCode?: string | null
): string {
  if (!phone) return "No phone provided";

  let code = countryCode || "91";

  code = code.replace(/^\+/, "");

  return `+${code} ${phone}`;
}

export function displayPhone(
  phone?: string | null,
  countryCode?: string | null
): string {
  if (!phone) return "N/A";

  let code = countryCode || "91";

  code = code.replace(/^\+/, "");

  return `+${code} ${phone}`;
}
