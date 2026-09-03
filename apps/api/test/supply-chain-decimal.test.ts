import assert from "node:assert/strict";
import test from "node:test";

import {
  requireNonNegative,
  requirePercentage,
  requirePositive,
  toDecimal,
} from "../src/services/supplyChain/decimal.js";

test("supply-chain decimals reject coercion and exponent notation", () => {
  assert.equal(toDecimal("123.4500").toString(), "123.45");
  assert.throws(() => toDecimal("12units"), /valid number/);
  assert.throws(() => toDecimal("1e3"), /valid number/);
  assert.throws(() => toDecimal("01"), /valid number/);
});

test("positive and non-negative decimal contracts are distinct", () => {
  assert.equal(requireNonNegative("0", "amount").toString(), "0");
  assert.throws(() => requireNonNegative("-0.01", "amount"), /negative/);
  assert.throws(() => requirePositive("0", "quantity"), /greater than zero/);
  assert.equal(requirePositive("0.01", "quantity").toString(), "0.01");
  assert.equal(requirePercentage("100", "discount").toString(), "100");
  assert.throws(() => requirePercentage("100.01", "discount"), /exceed 100/);
});
