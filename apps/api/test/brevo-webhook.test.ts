import assert from "node:assert/strict";
import test from "node:test";
import {
  BrevoWebhookPayloadError,
  brevoEngagementScore,
  parseBrevoWebhookPayload,
} from "../src/services/brevo-webhook.service.js";

const receivedAt = new Date("2026-09-03T10:00:00.000Z");

test("Brevo parses official flat marketing webhook fields", () => {
  const [event] = parseBrevoWebhookPayload(
    {
      id: 123,
      camp_id: 456,
      email: " PERSON@Example.com ",
      event: "click",
      ts_event: 1_788_428_400,
    },
    receivedAt
  );

  assert.ok(event);
  assert.equal(event.event, "clicked");
  assert.equal(event.email, "person@example.com");
  assert.equal(event.campaignExternalId, 456);
  assert.equal(event.providerEventId, "123");
  assert.equal(brevoEngagementScore(event.event!), 10);
});

test("Brevo accepts batches and distinguishes hard from soft suppression", () => {
  const events = parseBrevoWebhookPayload(
    [
      { event: "hard_bounce", email: "a@example.com" },
      { event: "soft_bounce", email: "b@example.com" },
      { event: "unsubscribe", email: "c@example.com" },
    ],
    receivedAt
  );

  assert.deepEqual(
    events.map(event => [event.event, event.suppressEmail]),
    [
      ["bounced", true],
      ["bounced", false],
      ["unsubscribed", true],
    ]
  );
});

test("unknown Brevo events are inert while malformed known events fail", () => {
  const [unknown] = parseBrevoWebhookPayload(
    { event: "contact_updated", id: 9 },
    receivedAt
  );
  assert.equal(unknown?.event, null);
  assert.equal(unknown?.email, null);

  assert.throws(
    () => parseBrevoWebhookPayload({ event: "delivered" }, receivedAt),
    BrevoWebhookPayloadError
  );
  assert.throws(
    () => parseBrevoWebhookPayload({ event: { name: "opened" } }, receivedAt),
    BrevoWebhookPayloadError
  );
});
