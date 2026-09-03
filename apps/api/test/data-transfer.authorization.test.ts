import assert from "node:assert/strict";
import test from "node:test";

import {
  canTransfer,
  TRANSFER_PERMISSIONS,
  type TransferEntityKey,
} from "../src/services/dataTransfer/authorization.js";

test("sales defaults cannot use the bulk export boundary", () => {
  assert.equal(canTransfer("SALES", [], "leads", "export"), false);
  assert.equal(canTransfer("SALES", [], "users", "export"), false);
  assert.equal(canTransfer("SALES", [], "leads", "import"), false);
});

test("custom exports require both global export and dataset view access", () => {
  const permissions = ["reports.export", "leads.view"];
  assert.equal(canTransfer("CUSTOM", permissions, "leads", "export"), true);
  assert.equal(canTransfer("CUSTOM", permissions, "users", "export"), false);
  assert.equal(
    canTransfer("CUSTOM", permissions, "customer-invoices", "export"),
    false
  );
});

test("imports require both bulk-import and dataset manage permissions", () => {
  assert.equal(
    canTransfer("CUSTOM", ["data.import", "leads.manage"], "leads", "import"),
    true
  );
  assert.equal(canTransfer("CUSTOM", ["leads.view"], "leads", "import"), false);
  assert.equal(
    canTransfer(
      "CUSTOM",
      ["data.import", "production.manage"],
      "work-centers",
      "import"
    ),
    true
  );
});

test("admins retain every declared transfer capability", () => {
  for (const [entity, rule] of Object.entries(TRANSFER_PERMISSIONS)) {
    const key = entity as TransferEntityKey;
    assert.equal(canTransfer("ADMIN", [], key, "export"), true);
    if (rule.import) {
      assert.equal(canTransfer("ADMIN", [], key, "import"), true);
    }
  }
});
