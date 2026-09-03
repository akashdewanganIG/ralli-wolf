import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";

import {
  optionalString,
  parseDate,
  parseEnum,
  parseId,
  parsePagination,
} from "../src/utils/supply-chain-http.js";

test("supply-chain IDs and pagination reject coercion", () => {
  assert.throws(() => parseId("12junk", "id"), /valid id/);
  assert.throws(() => parseId("1e2", "id"), /valid id/);
  assert.equal(parseId("12", "id"), 12);

  const request = { query: { page: "2x", limit: "25" } } as unknown as Request;
  assert.throws(() => parsePagination(request), /page must be positive/);
});

test("supply-chain dates and enums reject fuzzy or structural coercion", () => {
  assert.equal(
    parseDate("2026-09-02", "date")?.toISOString(),
    "2026-09-02T00:00:00.000Z"
  );
  assert.throws(() => parseDate("next Tuesday", "date"), /valid date/);
  assert.throws(
    () => parseEnum({ DRAFT: "DRAFT" }, ["DRAFT"], "status"),
    /must be one of/
  );
});

test("optional strings reject non-text and oversized payloads", () => {
  assert.equal(optionalString(undefined), null);
  assert.equal(optionalString("  note  "), "note");
  assert.throws(() => optionalString({}), /must be text/);
  assert.throws(() => optionalString("long", "note", 3), /must not exceed/);
});
