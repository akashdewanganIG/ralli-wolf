import { randomInt } from "node:crypto";

function pick(pool: string): string {
  return pool[randomInt(pool.length)]!;
}

function shuffle(characters: string[]): string[] {
  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [characters[i], characters[j]] = [characters[j]!, characters[i]!];
  }
  return characters;
}

function generatePassword(
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

  if (includeUppercase) characterPool += uppercase;
  if (includeLowercase) characterPool += lowercase;
  if (includeNumbers) characterPool += numbers;
  if (includeSymbols) characterPool += symbols;

  if (characterPool.length === 0) {
    characterPool = lowercase + numbers;
  }

  if (includeUppercase) characters.push(pick(uppercase));
  if (includeLowercase) characters.push(pick(lowercase));
  if (includeNumbers) characters.push(pick(numbers));
  if (includeSymbols) characters.push(pick(symbols));

  while (characters.length < length) {
    characters.push(pick(characterPool));
  }

  return shuffle(characters).join("");
}

export function generateAccountPlaceholder(): string {
  return generatePassword(14, {
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: false,
  });
}

export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length < 8) {
    feedback.push("Password must be at least 8 characters long");
  } else if (password.length >= 8 && password.length < 12) {
    score += 1;
  } else if (password.length >= 12) {
    score += 2;
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Password should contain at least one uppercase letter");
  }

  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Password should contain at least one lowercase letter");
  }

  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Password should contain at least one number");
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Password should contain at least one special character");
  }

  const commonPatterns = ["12345", "password", "qwerty", "abc123", "111111"];
  const lowerPassword = password.toLowerCase();
  for (const pattern of commonPatterns) {
    if (lowerPassword.includes(pattern)) {
      score -= 2;
      feedback.push("Password contains common patterns");
      break;
    }
  }

  const isValid = password.length >= 8 && score >= 4;

  return {
    isValid,
    score: Math.max(0, score),
    feedback,
  };
}

export function generateRandomString(length: number = 32): string {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += pick(characters);
  }
  return result;
}

export function generateNumericOtp(digits: number = 6): string {
  return randomInt(0, 10 ** digits)
    .toString()
    .padStart(digits, "0");
}
