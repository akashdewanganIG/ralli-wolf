import assert from "node:assert/strict";
import test from "node:test";
import { brevoDeliveryIdempotencyKey } from "../src/services/brevo-campaign.service.js";

test("Brevo delivery idempotency keys are stable UUIDs", () => {
  assert.equal(
    brevoDeliveryIdempotencyKey(42),
    "00000000-0000-4000-8000-00000000002a"
  );
  assert.equal(
    brevoDeliveryIdempotencyKey(42),
    brevoDeliveryIdempotencyKey(42)
  );
  assert.notEqual(
    brevoDeliveryIdempotencyKey(42),
    brevoDeliveryIdempotencyKey(43)
  );
  assert.throws(() => brevoDeliveryIdempotencyKey(0));
});
