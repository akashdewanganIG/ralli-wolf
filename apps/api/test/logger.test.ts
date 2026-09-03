import assert from "node:assert/strict";
import test from "node:test";
import { logError } from "../src/utils/logger.js";

test("operational logs retain diagnostics while redacting secrets and PII", () => {
  const original = console.error;
  let output = "";
  console.error = (...values: unknown[]) => {
    output = values.map(String).join(" ");
  };

  try {
    const error = Object.assign(
      new Error("alice@example.com failed with Bearer raw-token"),
      { code: "PROVIDER_FAILURE" }
    );
    logError("provider_request_failed", error, {
      userId: 42,
      email: "alice@example.com",
      phone: "+91 98765 43210",
      nested: { token: "raw-token", state: "retryable" },
    });
  } finally {
    console.error = original;
  }

  const parsed = JSON.parse(output) as {
    level: string;
    event: string;
    context: Record<string, unknown>;
  };
  assert.equal(parsed.level, "error");
  assert.equal(parsed.event, "provider_request_failed");
  assert.equal(parsed.context.userId, 42);
  assert.equal(parsed.context.email, "[REDACTED]");
  assert.equal(parsed.context.phone, "[REDACTED]");
  assert.equal(parsed.context.nested.token, "[REDACTED]");
  assert.equal(parsed.context.nested.state, "retryable");
  assert.deepEqual(parsed.context.error, {
    type: "Error",
    code: "PROVIDER_FAILURE",
  });
  assert.doesNotMatch(output, /alice|raw-token|98765/);
});
