/**
 * Password Utility Functions
 * Handles password generation and validation
 *
 * Everything random in this file comes from `node:crypto`. `Math.random()` is a
 * fast non-cryptographic PRNG whose output is predictable from a handful of
 * observed values, so it must never pick a character in a credential.
 */

import { randomInt } from "node:crypto";

/** Pick one character from `pool` with a uniform, unbiased distribution. */
function pick(pool: string): string {
  return pool[randomInt(pool.length)]!;
}

/** Fisher-Yates, so every permutation is equally likely. */
function shuffle(characters: string[]): string[] {
  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [characters[i], characters[j]] = [characters[j]!, characters[i]!];
  }
  return characters;
}

/**
 * Generate a secure random password
 * @param length - Length of the password (default: 12)
 * @param options - Options for password complexity
 * @returns Generated password string
 */
export function generatePassword(
  length: number = 12,
  options: {
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSymbols?: boolean;
  } = {}
): string {
  const {
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSymbols = true,
  } = options;

  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  let characterPool = "";
  const characters: string[] = [];

  // Build character pool based on options
  if (includeUppercase) characterPool += uppercase;
  if (includeLowercase) characterPool += lowercase;
  if (includeNumbers) characterPool += numbers;
  if (includeSymbols) characterPool += symbols;

  // Ensure at least one character set is included
  if (characterPool.length === 0) {
    characterPool = lowercase + numbers; // Default fallback
  }

  // Ensure password has at least one character from each selected type
  if (includeUppercase) characters.push(pick(uppercase));
  if (includeLowercase) characters.push(pick(lowercase));
  if (includeNumbers) characters.push(pick(numbers));
  if (includeSymbols) characters.push(pick(symbols));

  // Fill the rest of the password with random characters from the pool
  while (characters.length < length) {
    characters.push(pick(characterPool));
  }

  // Shuffle so the guaranteed characters do not sit in a fixed order
  return shuffle(characters).join("");
}

/**
 * Generate a secure password suitable for new user accounts.
 *
 * 14 characters of [A-Za-z0-9] is ~83 bits of entropy, which stays out of reach
 * of an offline attack on the bcrypt hash. Symbols are excluded so the password
 * survives being copied out of an email on any keyboard layout; the length more
 * than makes up for the smaller alphabet. The recipient is required to replace
 * it on first sign-in (see `mustChangePassword`), so it only has to hold up for
 * a single login.
 */
export function generateUserPassword(): string {
  return generatePassword(14, {
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: false,
  });
}

/**
 * Generate a simple memorable password (no symbols)
 * Useful for temporary passwords that users will change
 */
export function generateSimplePassword(length: number = 10): string {
  return generatePassword(length, {
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: false,
  });
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Object with validation result and strength score
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  // Check length
  if (password.length < 8) {
    feedback.push("Password must be at least 8 characters long");
  } else if (password.length >= 8 && password.length < 12) {
    score += 1;
  } else if (password.length >= 12) {
    score += 2;
  }

  // Check for uppercase
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Password should contain at least one uppercase letter");
  }

  // Check for lowercase
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Password should contain at least one lowercase letter");
  }

  // Check for numbers
  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Password should contain at least one number");
  }

  // Check for symbols
  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Password should contain at least one special character");
  }

  // Check for common patterns
  const commonPatterns = ["12345", "password", "qwerty", "abc123", "111111"];
  const lowerPassword = password.toLowerCase();
  for (const pattern of commonPatterns) {
    if (lowerPassword.includes(pattern)) {
      score -= 2;
      feedback.push("Password contains common patterns");
      break;
    }
  }

  // Minimum requirements: length >= 8 and score >= 4
  const isValid = password.length >= 8 && score >= 4;

  return {
    isValid,
    score: Math.max(0, score), // Ensure score doesn't go negative
    feedback,
  };
}

/**
 * Generate a random alphanumeric string (useful for tokens)
 */
export function generateRandomString(length: number = 32): string {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += pick(characters);
  }
  return result;
}

/**
 * Generate a numeric one-time code of `digits` length, keeping leading zeros so
 * every code is the same width.
 */
export function generateNumericOtp(digits: number = 6): string {
  return randomInt(0, 10 ** digits)
    .toString()
    .padStart(digits, "0");
}
