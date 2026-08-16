/**
 * Validate email address with specific domain requirements
 * Pattern: ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|co|in|org|net|edu|gov|io|info)$
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }
  const emailRegex =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|co|in|org|net|edu|gov|io|info)$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate phone number
 * Accepts any 10-digit number (0-9)
 * Strips non-digit characters before validation
 */
export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone || typeof phone !== "string") {
    return false;
  }
  const trimmed = phone.trim();
  // Remove all non-digit characters
  const digitsOnly = trimmed.replace(/\D/g, "");
  // Must be exactly 10 digits
  return /^\d{10}$/.test(digitsOnly);
}

/**
 * Validate name field
 * - Non-empty after trim
 * - Max 255 characters
 */
export function isValidName(name: string | null | undefined): boolean {
  if (!name || typeof name !== "string") {
    return false;
  }
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 255;
}

/**
 * Validate pincode (6 digits)
 */
export function isValidPincode(pincode: string | null | undefined): boolean {
  if (!pincode || typeof pincode !== "string") {
    return false;
  }
  const pincodeRegex = /^\d{6}$/;
  return pincodeRegex.test(pincode.trim());
}

/**
 * Validate website URL format (basic validation)
 */
export function isValidWebsite(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }
  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return false;
  }
  // Basic URL validation - starts with http:// or https://
  const urlRegex = /^https?:\/\/.+/;
  return urlRegex.test(trimmed);
}

/**
 * Validate field length
 */
export function validateFieldLength(
  field: string | null | undefined,
  maxLength: number
): boolean {
  if (!field || typeof field !== "string") {
    return true; // Empty fields are valid for length check (use required check separately)
  }
  return field.trim().length <= maxLength;
}

/**
 * Validate GST number
 * Pattern: 15 characters, alphanumeric
 * Format: 15AABCC1234D1Z5 (2 char state code + 10 char PAN + 3 char entity number + 1 char Z + 1 digit checksum)
 */
export function isValidGstNumber(gst: string | null | undefined): boolean {
  if (!gst || typeof gst !== "string") {
    return false;
  }
  const trimmed = gst.trim().toUpperCase();
  // GST number should be exactly 15 characters, alphanumeric
  const gstRegex = /^[0-9A-Z]{15}$/;
  return gstRegex.test(trimmed);
}

/**
 * Import-specific validation functions
 * These are used for Excel/CSV lead imports with specific validation rules
 */

/**
 * Validate name for import - must be a non-numeric string
 * Checks that the name contains at least one non-digit character
 */
export function isValidNameForImport(name: string | null | undefined): boolean {
  if (!name || typeof name !== "string") {
    return false;
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return false;
  }
  // Check if name contains at least one non-digit character
  // This ensures it's not purely numeric
  return /[^0-9]/.test(trimmed);
}

/**
 * Validate phone number for import - must be exactly 10 digits
 * Accepts any 10-digit phone number (not restricted to Indian format)
 */
export function isValidPhoneForImport(
  phone: string | null | undefined
): boolean {
  if (!phone || typeof phone !== "string") {
    return false;
  }
  const trimmed = phone.trim();
  // Remove any non-digit characters for validation
  const digitsOnly = trimmed.replace(/\D/g, "");
  // Must be exactly 10 digits
  return /^\d{10}$/.test(digitsOnly);
}

/**
 * Validate email for import - must be a valid email format
 * Uses standard email regex without TLD restrictions
 */
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
  // Standard email regex: local@domain format
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(trimmed);
}

/**
 * Validate pincode for import - must be exactly 6 digits
 * Reuses the existing isValidPincode function
 */
export function isValidPincodeForImport(
  pincode: string | null | undefined
): boolean {
  return isValidPincode(pincode);
}

/**
 * Validate company for import - must be a valid string if provided
 * If company is provided, it must be non-empty after trimming
 */
export function isValidCompanyForImport(
  company: string | null | undefined
): boolean {
  // Company is optional, so empty/null/undefined is valid
  if (!company || typeof company !== "string") {
    return true;
  }
  // If provided, it must be non-empty after trimming
  return company.trim().length > 0;
}
