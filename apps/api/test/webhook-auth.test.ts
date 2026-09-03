import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type { Request } from "express";
import {
  verifyWebhookRequest,
  webhookBodyDigest,
} from "../src/utils/webhook-auth.js";

function request(headers: Record<string, string>, rawBody?: Buffer): Request {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    rawBody,
    get(name: string) {
      return normalized[name.toLowerCase()];
    },
  } as Request;
}

test("webhook bearer and custom-header tokens use the configured secret", () => {
  assert.equal(
    verifyWebhookRequest(
      request({ authorization: "Bearer expected" }),
      "expected"
    ),
    true
  );
  assert.equal(
    verifyWebhookRequest(
      request({ "x-webhook-secret": "expected" }),
      "expected"
    ),
    true
  );
  assert.equal(
    verifyWebhookRequest(
      request({ authorization: "Bearer wrong" }),
      "expected"
    ),
    false
  );
});

test("webhook HMAC covers the exact raw request bytes", () => {
  const secret = "webhook-test-secret";
  const rawBody = Buffer.from('{ "b": 2, "a": 1 }');
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");

  assert.equal(
    verifyWebhookRequest(
      request({ "x-provider-signature": `sha256=${digest}` }, rawBody),
      secret,
      ["x-provider-signature"]
    ),
    true
  );
  assert.equal(
    verifyWebhookRequest(
      request(
        { "x-provider-signature": `sha256=${digest}` },
        Buffer.from('{"a":1,"b":2}')
      ),
      secret,
      ["x-provider-signature"]
    ),
    false
  );
});

test("malformed signatures and absent raw bodies are rejected without throwing", () => {
  assert.equal(
    verifyWebhookRequest(
      request({ "x-webhook-signature": "sha256=not-hex" }, Buffer.from("{}")),
      "secret"
    ),
    false
  );
  assert.equal(
    verifyWebhookRequest(
      request({ "x-webhook-signature": "sha256=abc" }),
      "secret"
    ),
    false
  );
});

test("replay digests are provider-scoped and cover exact body bytes", () => {
  const body = Buffer.from('{"event":"delivered"}');
  assert.equal(
    webhookBodyDigest("msg91", body),
    webhookBodyDigest("msg91", body)
  );
  assert.notEqual(
    webhookBodyDigest("msg91", body),
    webhookBodyDigest("brevo", body)
  );
  assert.notEqual(
    webhookBodyDigest("msg91", body),
    webhookBodyDigest("msg91", Buffer.from('{ "event": "delivered" }'))
  );
});
