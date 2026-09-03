import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeEncryptionKey,
  decryptSecret,
  encryptSecret,
} from "@repo/db/crypto";

test("encryption keys must decode to exactly 32 bytes", () => {
  assert.equal(decodeEncryptionKey("a".repeat(32)).length, 32);
  assert.equal(decodeEncryptionKey(`hex:${"ab".repeat(32)}`).length, 32);
  assert.equal(
    decodeEncryptionKey(`base64:${Buffer.alloc(32, 7).toString("base64")}`)
      .length,
    32
  );
  assert.throws(() => decodeEncryptionKey(undefined), /required/);
  assert.throws(() => decodeEncryptionKey("short"), /exactly 32 bytes/);
  assert.throws(() => decodeEncryptionKey("hex:not-hex"), /hexadecimal/);
  assert.throws(() => decodeEncryptionKey("base64:%%%"), /base64/);
});

test("shared secret encryption round-trips with authenticated encryption", () => {
  const original = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = `base64:${Buffer.alloc(32, 11).toString("base64")}`;
  try {
    const encrypted = encryptSecret("provider-secret");
    assert.equal(
      decryptSecret(encrypted.cipherText, encrypted.iv, encrypted.authTag),
      "provider-secret"
    );
    assert.throws(() =>
      decryptSecret(
        encrypted.cipherText,
        encrypted.iv,
        Buffer.alloc(16).toString("base64")
      )
    );
  } finally {
    if (original === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = original;
  }
});
