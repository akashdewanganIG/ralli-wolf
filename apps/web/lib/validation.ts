/**
 * Client-side validation utilities
 * Uses the same regex patterns as server-side validators for consistency
 */

/**
 * Validate email address with specific domain requirements
 * Pattern: ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|co|in|org|net|edu|gov|io|info)$
 */
export function validateEmail(email: string): {
  isValid: boolean;
  error?: string;
} {
  if (!email || typeof email !== "string") {
    return { isValid: false, error: "Email is required" };
  }

  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: "Email is required" };
  }

  const emailRegex =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|co|in|org|net|edu|gov|io|info)$/;
  if (!emailRegex.test(trimmed)) {
    return {
      isValid: false,
      error:
        "Invalid email format. Email must end with .com, .co, .in, .org, .net, .edu, .gov, .io, or .info",
    };
  }

  return { isValid: true };
}

/**
 * Validate phone number
 * Accepts any 10-digit number (0-9)
 * Strips non-digit characters before validation
 */
export function validatePhone(phone: string): {
  isValid: boolean;
  error?: string;
} {
  if (!phone || typeof phone !== "string") {
    return { isValid: false, error: "Phone number is required" };
  }

  const trimmed = phone.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: "Phone number is required" };
  }

  // Remove all non-digit characters
  const digitsOnly = trimmed.replace(/\D/g, "");

  // Check if exactly 10 digits
  if (digitsOnly.length !== 10) {
    return {
      isValid: false,
      error: "Invalid phone number. Phone must be 10 digits.",
    };
  }

  return { isValid: true };
}

/**
 * Validate phone number (optional field)
 * Accepts any 10-digit number (0-9) if provided
 * Strips non-digit characters before validation
 */
export function validatePhoneOptional(phone: string): {
  isValid: boolean;
  error?: string;
} {
  if (!phone || typeof phone !== "string") {
    return { isValid: true }; // Optional field
  }

  const trimmed = phone.trim();
  if (trimmed.length === 0) {
    return { isValid: true }; // Optional field
  }

  // Remove all non-digit characters
  const digitsOnly = trimmed.replace(/\D/g, "");

  // Check if exactly 10 digits
  if (digitsOnly.length !== 10) {
    return {
      isValid: false,
      error: "Invalid phone number. Phone must be 10 digits.",
    };
  }

  return { isValid: true };
}

/**
 * Validate name field
 * - Non-empty after trim
 * - Max 255 characters
 */
export function validateName(name: string): {
  isValid: boolean;
  error?: string;
} {
  if (!name || typeof name !== "string") {
    return { isValid: false, error: "Name is required" };
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: "Name is required" };
  }

  if (trimmed.length > 255) {
    return { isValid: false, error: "Name must be 255 characters or less" };
  }

  return { isValid: true };
}

/**
 * Validate pincode (6 digits)
 */
export function validatePincode(pincode: string): {
  isValid: boolean;
  error?: string;
} {
  if (!pincode || typeof pincode !== "string") {
    return { isValid: true }; // Optional field
  }

  const trimmed = pincode.trim();
  if (trimmed.length === 0) {
    return { isValid: true }; // Optional field
  }

  const pincodeRegex = /^\d{6}$/;
  if (!pincodeRegex.test(trimmed)) {
    return { isValid: false, error: "Pincode must be exactly 6 digits" };
  }

  return { isValid: true };
}

/**
 * Validate field length
 */
export function validateFieldLength(
  field: string,
  maxLength: number
): { isValid: boolean; error?: string } {
  if (!field || typeof field !== "string") {
    return { isValid: true }; // Empty fields are valid for length check
  }

  const trimmed = field.trim();
  if (trimmed.length > maxLength) {
    return {
      isValid: false,
      error: `Field must be ${maxLength} characters or less`,
    };
  }

  return { isValid: true };
}

/**
 * Validate website URL format (basic validation)
 */
export function validateWebsite(url: string): {
  isValid: boolean;
  error?: string;
} {
  if (!url || typeof url !== "string") {
    return { isValid: true }; // Optional field
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return { isValid: true }; // Optional field
  }

  // Basic URL validation - starts with http:// or https://
  const urlRegex = /^https?:\/\/.+/;
  if (!urlRegex.test(trimmed)) {
    return {
      isValid: false,
      error: "Website must start with http:// or https://",
    };
  }

  return { isValid: true };
}

/**
 * Basic email format validation (for login, less strict)
 */
export function validateEmailBasic(email: string): {
  isValid: boolean;
  error?: string;
} {
  if (!email || typeof email !== "string") {
    return { isValid: false, error: "Email is required" };
  }

  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: "Email is required" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: "Invalid email format" };
  }

  return { isValid: true };
}
