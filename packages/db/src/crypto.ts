import * as nodeCrypto from "node:crypto";

export type EncryptedSecret = {
  cipherText: string;
  iv: string;
  authTag: string;
};

export function decodeEncryptionKey(
  configured: string | undefined = process.env.ENCRYPTION_KEY
): Buffer {
  const value = configured?.trim();
  if (!value) {
    throw new Error("ENCRYPTION_KEY is required");
  }

  let key: Buffer;
  if (value.startsWith("base64:")) {
    const encoded = value.slice(7);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 === 1) {
      throw new Error("ENCRYPTION_KEY has invalid base64 encoding");
    }
    key = Buffer.from(encoded, "base64");
  } else if (value.startsWith("hex:")) {
    const encoded = value.slice(4);
    if (!/^[0-9a-fA-F]{64}$/.test(encoded)) {
      throw new Error(
        "ENCRYPTION_KEY must contain exactly 64 hexadecimal characters"
      );
    }
    key = Buffer.from(encoded, "hex");
  } else {
    key = Buffer.from(value, "utf8");
  }

  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

export function encryptSecret(plainText: string): EncryptedSecret {
  const key = decodeEncryptionKey();
  const iv = nodeCrypto.randomBytes(12);
  const cipher = nodeCrypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  return {
    cipherText: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(
  cipherText: string,
  iv: string,
  authTag: string
): string {
  const key = decodeEncryptionKey();
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
