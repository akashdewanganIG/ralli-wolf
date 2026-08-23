import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Authenticated encryption for secrets that must be readable again — currently
 * only the TOTP shared secret, which the server needs in cleartext to validate
 * a code but must never store in the clear.
 *
 * AES-256-GCM: the tag makes tampering detectable, so a row edited in the
 * database fails closed instead of silently validating against a swapped
 * secret.
 *
 * The key comes from `TOTP_ENCRYPTION_KEY`. It falls back to deriving one from
 * `JWT_SECRET` so an existing deployment keeps working, but a dedicated key is
 * strongly preferred: rotating the JWT secret would otherwise strand every
 * enrolled authenticator.
 */
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT = "ralli-wolf/totp/v1";

let cachedKey: Buffer | null = null;

function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const configured = process.env.TOTP_ENCRYPTION_KEY?.trim();
  const material = configured || process.env.JWT_SECRET?.trim();

  if (!material) {
    throw new Error(
      "TOTP_ENCRYPTION_KEY (or JWT_SECRET) must be set to store authenticator secrets"
    );
  }
  if (!configured) {
    console.warn(
      "TOTP_ENCRYPTION_KEY is not set; deriving from JWT_SECRET. Rotating JWT_SECRET will invalidate every enrolled authenticator."
    );
  }

  cachedKey = scryptSync(material, SALT, KEY_LENGTH);
  return cachedKey;
}

/** Returns `v1.<iv>.<tag>.<ciphertext>`, all base64url. */
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

/** Throws if the value was tampered with or the key changed. */
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
