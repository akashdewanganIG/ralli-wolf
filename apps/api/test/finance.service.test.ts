import assert from "node:assert/strict";
import test from "node:test";

import { normalizePaymentAllocations } from "../src/services/finance/finance.service.js";

test("payment allocations combine duplicate invoice rows", () => {
  const allocations = normalizePaymentAllocations([
    { supplierInvoiceId: 7, amount: "10.25" },
    { customerInvoiceId: 3, amount: "2.00" },
    { supplierInvoiceId: 7, amount: "4.75" },
  ]);

  assert.deepEqual(
    allocations.map(line => ({
      side: line.side,
      invoiceId: line.invoiceId,
      amount: line.amount.toFixed(2),
    })),
    [
      { side: "SUPPLIER", invoiceId: 7, amount: "15.00" },
      { side: "CUSTOMER", invoiceId: 3, amount: "2.00" },
    ]
  );
});

test("payment allocations require one valid target and a positive amount", () => {
  assert.throws(
    () => normalizePaymentAllocations([{ amount: "1.00" }]),
    /exactly one/
  );
  assert.throws(
    () =>
      normalizePaymentAllocations([
        { supplierInvoiceId: 1, customerInvoiceId: 2, amount: "1.00" },
      ]),
    /exactly one/
  );
  assert.throws(
    () => normalizePaymentAllocations([{ supplierInvoiceId: 0, amount: 1 }]),
    /invalid invoice id/
  );
  assert.throws(
    () => normalizePaymentAllocations([{ supplierInvoiceId: 1, amount: 0 }]),
    /greater than zero/
  );
});
