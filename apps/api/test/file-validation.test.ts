import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeBase64File,
  verifyFileContent,
} from "../src/utils/file-validation.js";

const IMAGES = ["image/jpeg", "image/png", "image/webp"] as const;

test("image validation uses byte signatures and canonicalizes JPEG MIME", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
  assert.deepEqual(verifyFileContent(jpeg, "image/jpg", IMAGES), {
    mimeType: "image/jpeg",
    extension: "jpg",
  });

  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
  ]);
  assert.equal(verifyFileContent(png, "image/jpeg", IMAGES), null);
});

test("active content cannot pass by declaring an image MIME type", () => {
  const svg = Buffer.from('<svg onload="alert(1)"></svg>');
  const html = Buffer.from("<html><script>alert(1)</script></html>");
  assert.equal(verifyFileContent(svg, "image/svg+xml", IMAGES), null);
  assert.equal(verifyFileContent(svg, "image/png", IMAGES), null);
  assert.equal(verifyFileContent(html, "image/jpeg", IMAGES), null);
});

test("PDF validation rejects a spoofed header and accepts a complete payload", () => {
  const allowed = ["application/pdf"];
  assert.equal(
    verifyFileContent(Buffer.from("%PDF-fake"), "application/pdf", allowed),
    null
  );
  assert.deepEqual(
    verifyFileContent(
      Buffer.from("%PDF-1.7\n1 0 obj\nendobj\n%%EOF\n"),
      "application/pdf",
      allowed
    ),
    { mimeType: "application/pdf", extension: "pdf" }
  );
});

test("base64 decoding is strict and enforces the decoded size", () => {
  assert.deepEqual(decodeBase64File("aGVsbG8=", 5), Buffer.from("hello"));
  assert.equal(decodeBase64File("aGVs bG8=", 10), null);
  assert.equal(decodeBase64File("data:text/plain;base64,aA==", 10), null);
  assert.equal(decodeBase64File("aGVsbG8=", 4), null);
});
