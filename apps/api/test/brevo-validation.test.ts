import assert from "node:assert/strict";
import test from "node:test";
import {
  BrevoRequestError,
  parseBrevoCampaignFilterStatus,
  parseBrevoCampaignStatusAction,
  parseBrevoCampaignUpdate,
} from "../src/services/brevo-validation.js";

test("Brevo campaign updates retain only validated provider fields", () => {
  assert.deepEqual(
    parseBrevoCampaignUpdate({
      name: "  September launch ",
      replyTo: " SALES@Example.com ",
      recipients: { listIds: [7, "8"] },
      scheduledAt: "2099-09-04T10:30:00+05:30",
    }),
    {
      name: "September launch",
      replyTo: "sales@example.com",
      recipients: { listIds: [7, 8] },
      scheduledAt: "2099-09-04T05:00:00.000Z",
    }
  );
});

test("Brevo scheduling requires a future timezone-qualified timestamp", () => {
  assert.throws(
    () => parseBrevoCampaignUpdate({ scheduledAt: "2099-09-04T10:30:00" }),
    BrevoRequestError
  );
  assert.throws(
    () => parseBrevoCampaignUpdate({ scheduledAt: "2020-01-01T00:00:00Z" }),
    BrevoRequestError
  );
});

test("Brevo campaign status parsers enforce exact request contracts", () => {
  assert.equal(parseBrevoCampaignFilterStatus(" SENT "), "sent");
  assert.equal(parseBrevoCampaignFilterStatus(undefined), undefined);
  assert.throws(
    () => parseBrevoCampaignFilterStatus(["sent"]),
    BrevoRequestError
  );
  assert.equal(parseBrevoCampaignStatusAction({ status: "cancel" }), "cancel");
  assert.throws(
    () => parseBrevoCampaignStatusAction({ status: "sent", force: true }),
    BrevoRequestError
  );
  assert.throws(
    () => parseBrevoCampaignStatusAction({ status: "SENT" }),
    BrevoRequestError
  );
});

test("Brevo campaign updates reject arbitrary fields and coercion", () => {
  assert.throws(
    () => parseBrevoCampaignUpdate({ name: "Campaign", admin: true }),
    BrevoRequestError
  );
  assert.throws(
    () => parseBrevoCampaignUpdate({ sender: { name: "Team", email: 1 } }),
    BrevoRequestError
  );
  assert.throws(
    () => parseBrevoCampaignUpdate({ recipients: { listIds: [1, 1] } }),
    BrevoRequestError
  );
});
