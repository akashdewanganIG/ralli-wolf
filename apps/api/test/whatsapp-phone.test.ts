import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeWhatsAppPhone,
  whatsappPhoneVariants,
} from "../src/services/whatsapp/phone.js";

test("WhatsApp phone normalization is consistent across local formats", () => {
  const expected = "919876543210";
  assert.equal(normalizeWhatsAppPhone("98765 43210"), expected);
  assert.equal(normalizeWhatsAppPhone("09876543210"), expected);
  assert.equal(normalizeWhatsAppPhone("+91 (98765) 43210"), expected);
  assert.equal(normalizeWhatsAppPhone("0091-98765-43210"), expected);
});

test("WhatsApp phone normalization rejects ambiguous or malformed values", () => {
  assert.equal(normalizeWhatsAppPhone("call 9876543210"), null);
  assert.equal(normalizeWhatsAppPhone("12345"), null);
  assert.equal(normalizeWhatsAppPhone("0000000000"), null);
  assert.equal(normalizeWhatsAppPhone(""), null);
});

test("WhatsApp phone variants cover persisted Indian CRM formats", () => {
  assert.deepEqual(whatsappPhoneVariants("919876543210"), [
    "919876543210",
    "+919876543210",
    "9876543210",
    "09876543210",
  ]);
});
