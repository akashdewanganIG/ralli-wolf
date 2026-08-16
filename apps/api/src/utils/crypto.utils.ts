import * as nodeCrypto from "node:crypto";

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || "";
  const buffer = key.startsWith("base64:")
    ? Buffer.from(key.slice(7), "base64")
    : key.startsWith("hex:")
      ? Buffer.from(key.slice(4), "hex")
      : Buffer.from(key, "utf8");
  if (buffer.length === 32) {
    return buffer;
  }
  return nodeCrypto.createHash("sha256").update(buffer).digest();
}

export function encryptSecret(plainText: string) {
  const key = getEncryptionKey();
  const iv = nodeCrypto.randomBytes(12);
  const cipher = nodeCrypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    cipherText: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptSecret(cipherText: string, iv: string, authTag: string) {
  const key = getEncryptionKey();
  const decipher = nodeCrypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherText, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
