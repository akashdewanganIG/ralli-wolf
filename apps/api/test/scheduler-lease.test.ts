import assert from "node:assert/strict";
import test from "node:test";
import { embeddedSchedulersEnabled } from "../src/jobs/scheduler-lease.js";

test("embedded schedulers are opt-in", () => {
  const original = process.env.RUN_EMBEDDED_SCHEDULERS;
  try {
    delete process.env.RUN_EMBEDDED_SCHEDULERS;
    assert.equal(embeddedSchedulersEnabled(), false);
    process.env.RUN_EMBEDDED_SCHEDULERS = "false";
    assert.equal(embeddedSchedulersEnabled(), false);
    process.env.RUN_EMBEDDED_SCHEDULERS = "TRUE";
    assert.equal(embeddedSchedulersEnabled(), true);
  } finally {
    if (original === undefined) delete process.env.RUN_EMBEDDED_SCHEDULERS;
    else process.env.RUN_EMBEDDED_SCHEDULERS = original;
  }
});
