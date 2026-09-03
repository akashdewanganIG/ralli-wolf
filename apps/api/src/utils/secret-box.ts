import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT = "ralli-wolf/totp/v1";

let cachedKey: Buffer | null = null;

function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const material = process.env.TOTP_ENCRYPTION_KEY?.trim();
  if (!material) {
    throw new Error(
      "TOTP_ENCRYPTION_KEY must be set to store authenticator secrets"
    );
  }
  if (Buffer.byteLength(material, "utf8") < 32) {
    throw new Error("TOTP_ENCRYPTION_KEY must contain at least 32 bytes");
  }

  cachedKey = scryptSync(material, SALT, KEY_LENGTH);
  return cachedKey;
}

export function sealSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function openSecret(sealed: string): string {
  const [version, ivPart, tagPart, dataPart] = sealed.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !dataPart) {
    throw new Error("Malformed sealed secret");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
