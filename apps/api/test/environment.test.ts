import assert from "node:assert/strict";
import test from "node:test";
import { serverPort } from "../src/config/environment.js";

test("server port is bounded and numeric", () => {
  const original = process.env.PORT;
  try {
    delete process.env.PORT;
    assert.equal(serverPort(), 4000);
    process.env.PORT = "8080";
    assert.equal(serverPort(), 8080);
    for (const invalid of ["0", "65536", "1.5", "http", "-1"]) {
      process.env.PORT = invalid;
      assert.throws(() => serverPort(), /PORT must be an integer/);
    }
  } finally {
    if (original === undefined) delete process.env.PORT;
    else process.env.PORT = original;
  }
});
