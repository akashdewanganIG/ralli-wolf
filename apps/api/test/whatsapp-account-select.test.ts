import assert from "node:assert/strict";
import test from "node:test";

import { WHATSAPP_ACCOUNT_PUBLIC_SELECT } from "../src/services/whatsapp/account-service.js";

test("WhatsApp account responses exclude encrypted credential material", () => {
  const selected = new Set(Object.keys(WHATSAPP_ACCOUNT_PUBLIC_SELECT));
  for (const secretField of [
    "encryptedApiKey",
    "iv",
    "authTag",
    "apiKey",
    "createdBy",
    "updatedBy",
  ]) {
    assert.equal(selected.has(secretField), false);
  }
});
