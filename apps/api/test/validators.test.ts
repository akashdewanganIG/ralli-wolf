import assert from "node:assert/strict";
import test from "node:test";

import {
  parseBoundedInteger,
  parseNonNegativeDecimal,
  parseIsoDate,
  parsePositiveDecimal,
  parsePositiveInteger,
  parsePageRange,
  parseStrictBoolean,
  parseUniquePositiveIntegerArray,
} from "../src/utils/validators.js";

test("integer parsing rejects prefixes, fractions, unsafe values, and bounds", () => {
  assert.equal(parsePositiveInteger("12"), 12);
  assert.equal(parsePositiveInteger("12junk"), null);
  assert.equal(parsePositiveInteger("1.2"), null);
  assert.equal(parsePositiveInteger(0), null);
  assert.equal(parsePositiveInteger(Number.MAX_SAFE_INTEGER + 1), null);
  assert.equal(parseBoundedInteger("100", 1, 100), 100);
  assert.equal(parseBoundedInteger("101", 1, 100), null);
});

test("ID array parsing rejects duplicates, coercion, and oversized batches", () => {
  assert.deepEqual(parseUniquePositiveIntegerArray([1, "2", 3]), [1, 2, 3]);
  assert.equal(parseUniquePositiveIntegerArray([1, 1]), null);
  assert.equal(parseUniquePositiveIntegerArray([1, "2x"]), null);
  assert.equal(parseUniquePositiveIntegerArray([], 10), null);
  assert.equal(parseUniquePositiveIntegerArray([1, 2, 3], 2), null);
});

test("ISO date parsing rejects fuzzy and impossible dates", () => {
  assert.equal(
    parseIsoDate("2026-09-01")?.toISOString(),
    "2026-09-01T00:00:00.000Z"
  );
  assert.equal(parseIsoDate("2026-02-30"), null);
  assert.equal(parseIsoDate("September 1, 2026"), null);
  assert.equal(parseIsoDate("2026-09-01T12:00:00"), null);
  assert.equal(
    parseIsoDate("2026-09-01T12:00:00+05:30")?.toISOString(),
    "2026-09-01T06:30:00.000Z"
  );
});

test("page ranges reject coercion, reversal, and oversized limits", () => {
  assert.deepEqual(parsePageRange(undefined, undefined, undefined, 50, 100), {
    startPage: 1,
    endPage: 1,
    limit: 50,
  });
  assert.equal(parsePageRange("2", "1", "50", 50, 100), null);
  assert.equal(parsePageRange("1junk", "2", "50", 50, 100), null);
  assert.equal(parsePageRange("1", "2", "101", 50, 100), null);
});

test("boolean parsing accepts only explicit JSON and form representations", () => {
  assert.equal(parseStrictBoolean(true), true);
  assert.equal(parseStrictBoolean("0"), false);
  assert.equal(parseStrictBoolean("false"), false);
  assert.equal(parseStrictBoolean("yes"), null);
  assert.equal(parseStrictBoolean(undefined), null);
});

test("decimal parsing preserves exact input and rejects coercion or rounding", () => {
  assert.equal(parsePositiveDecimal("123.4500"), "123.4500");
  assert.equal(parsePositiveDecimal("12price"), null);
  assert.equal(parsePositiveDecimal("1e3"), null);
  assert.equal(parsePositiveDecimal("0"), null);
  assert.equal(parsePositiveDecimal("1.12345"), null);
  assert.equal(parseNonNegativeDecimal("0"), "0");
  assert.equal(parseNonNegativeDecimal("100.25"), "100.25");
  assert.equal(parseNonNegativeDecimal("-1"), null);
  assert.equal(parseNonNegativeDecimal("1e3"), null);
});
