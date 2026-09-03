import assert from "node:assert/strict";
import test from "node:test";
import {
  assertProviderUrl,
  normalizeProviderBaseUrl,
} from "../src/utils/provider-url.js";

test("provider URLs accept only their approved HTTPS origins", () => {
  assert.equal(
    normalizeProviderBaseUrl("https://api.brevo.com/v3/", "brevo"),
    "https://api.brevo.com/v3"
  );
  assert.equal(
    normalizeProviderBaseUrl("https://control.msg91.com/api/v5", "msg91"),
    "https://control.msg91.com/api/v5"
  );
  assert.throws(
    () => assertProviderUrl("http://api.brevo.com/v3", "brevo"),
    /HTTPS/
  );
  assert.throws(
    () => assertProviderUrl("https://127.0.0.1/internal", "brevo"),
    /not approved/
  );
  assert.throws(
    () => assertProviderUrl("https://api.brevo.com.evil.test/v3", "brevo"),
    /not approved/
  );
  assert.throws(
    () => assertProviderUrl("https://user:pass@api.brevo.com/v3", "brevo"),
    /embedded credentials/
  );
});

test("provider base URLs reject query and fragment injection", () => {
  assert.throws(
    () =>
      normalizeProviderBaseUrl("https://api.brevo.com/v3?target=x", "brevo"),
    /query or fragment/
  );
  assert.throws(
    () => normalizeProviderBaseUrl("https://api.msg91.com/api/v5#x", "msg91"),
    /query or fragment/
  );
});
