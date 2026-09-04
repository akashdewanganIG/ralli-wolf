import assert from "node:assert/strict";
import test from "node:test";
import { shouldCountRateLimitResponse } from "../src/middleware/rate-limit.js";

test("login throttling counts rejected credentials but not successful requests", () => {
  const rejectedCredentialStatuses = [401] as const;

  assert.equal(
    shouldCountRateLimitResponse(401, rejectedCredentialStatuses),
    true
  );
  assert.equal(
    shouldCountRateLimitResponse(200, rejectedCredentialStatuses),
    false
  );
  assert.equal(
    shouldCountRateLimitResponse(503, rejectedCredentialStatuses),
    false
  );
  assert.equal(
    shouldCountRateLimitResponse(429, rejectedCredentialStatuses),
    false
  );
});

test("general throttles count every request when no response filter is set", () => {
  assert.equal(shouldCountRateLimitResponse(200), true);
  assert.equal(shouldCountRateLimitResponse(401), true);
  assert.equal(shouldCountRateLimitResponse(500), true);
});
