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

  const [local, domain, ...extra] = trimmed.split("@");
  const labels = domain?.split(".") ?? [];
  const valid =
    trimmed.length <= 254 &&
    !!local &&
    local.length <= 64 &&
    !local.startsWith(".") &&
    !local.endsWith(".") &&
    !local.includes("..") &&
    /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local) &&
    !extra.length &&
    labels.length >= 2 &&
    labels.every(
      label =>
        label.length >= 1 &&
        label.length <= 63 &&
        /^[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?$/i.test(label)
    ) &&
    labels[labels.length - 1]!.length >= 2;
  if (!valid) {
    return {
      isValid: false,
      error: "Enter a valid email address",
    };
  }

  return { isValid: true };
}

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

  const digitsOnly = trimmed.replace(/\D/g, "");

  if (digitsOnly.length !== 10) {
    return {
      isValid: false,
      error: "Invalid phone number. Phone must be 10 digits.",
    };
  }

  return { isValid: true };
}

export function validatePhoneOptional(phone: string): {
  isValid: boolean;
  error?: string;
} {
  if (!phone || typeof phone !== "string") {
    return { isValid: true };
  }

  const trimmed = phone.trim();
  if (trimmed.length === 0) {
    return { isValid: true };
  }

  const digitsOnly = trimmed.replace(/\D/g, "");

  if (digitsOnly.length !== 10) {
    return {
      isValid: false,
      error: "Invalid phone number. Phone must be 10 digits.",
    };
  }

  return { isValid: true };
}

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

export function validatePincode(pincode: string): {
  isValid: boolean;
  error?: string;
} {
  if (!pincode || typeof pincode !== "string") {
    return { isValid: true };
  }

  const trimmed = pincode.trim();
  if (trimmed.length === 0) {
    return { isValid: true };
  }

  const pincodeRegex = /^\d{6}$/;
  if (!pincodeRegex.test(trimmed)) {
    return { isValid: false, error: "Pincode must be exactly 6 digits" };
  }

  return { isValid: true };
}

export function validateFieldLength(
  field: string,
  maxLength: number
): { isValid: boolean; error?: string } {
  if (!field || typeof field !== "string") {
    return { isValid: true };
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

export function validateWebsite(url: string): {
  isValid: boolean;
  error?: string;
} {
  if (!url || typeof url !== "string") {
    return { isValid: true };
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return { isValid: true };
  }

  if (!safeHttpUrl(trimmed)) {
    return {
      isValid: false,
      error: "Website must be a valid http:// or https:// URL",
    };
  }

  return { isValid: true };
}

export function safeHttpUrl(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

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
