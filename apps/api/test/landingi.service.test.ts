import assert from "node:assert/strict";
import test from "node:test";
import {
  LandingiPayloadError,
  parseLandingiPayload,
  sanitizeLandingiPayload,
} from "../src/services/landingi.service.js";

test("Landingi parsing supports the documented envelope and full-name aliases", () => {
  const parsed = parseLandingiPayload({
    form_submission: {
      name: "  John Doe  ",
      email: " JOHN.DOE@Example.com ",
      phone: "+91 98765 43210",
      campaign_id: 42,
      company: "Acme",
      message: "Please contact me",
    },
  });

  assert.deepEqual(parsed.lead, {
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    phone: "9876543210",
    companyName: "Acme",
    city: null,
    state: null,
    pincode: null,
  });
  assert.equal(parsed.campaignUniqueId, "42");
  assert.deepEqual(parsed.customFields, { message: "Please contact me" });
});

test("Landingi parsing combines supported snake-case custom fields", () => {
  const parsed = parseLandingiPayload({
    custom_fields: {
      first_name: "Alice",
      last_name: "Williams",
      email: "alice@example.com",
      telephone: "09876543210",
      interest: "Industrial tools",
    },
    landing_page_campaign_id: "lp_123",
  });

  assert.equal(parsed.lead.firstName, "Alice");
  assert.equal(parsed.lead.lastName, "Williams");
  assert.equal(parsed.lead.phone, "9876543210");
  assert.equal(parsed.campaignUniqueId, "lp_123");
  assert.deepEqual(parsed.customFields, { interest: "Industrial tools" });
});

test("Landingi parsing rejects malformed envelopes and field coercion", () => {
  assert.throws(
    () => parseLandingiPayload({ form_submission: [] }),
    LandingiPayloadError
  );
  assert.throws(
    () => parseLandingiPayload({ name: "Test Person", email: { value: "x" } }),
    /Email must be a string/
  );
  assert.throws(
    () => parseLandingiPayload({ name: "Test Person", email: "bad" }),
    /valid email/
  );
});

test("stored Landingi payloads are bounded", () => {
  const stored = sanitizeLandingiPayload({
    name: "Test Person",
    email: "test@example.com",
    notes: "x".repeat(100_000),
  });

  assert.ok(Buffer.byteLength(JSON.stringify(stored), "utf8") < 70_000);
  assert.match(String(stored.notes), /truncated/);
});
