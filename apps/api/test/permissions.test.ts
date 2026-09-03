import assert from "node:assert/strict";
import test from "node:test";

import { resolvePermissions, roleHasPermission } from "@repo/db/permissions";

test("manage permissions imply the matching view permission", () => {
  assert.equal(
    roleHasPermission("CUSTOM", ["leads.manage"], "leads.view"),
    true
  );
  assert.equal(
    roleHasPermission("CUSTOM", ["finance.manage"], "finance.view"),
    true
  );
  assert.equal(
    roleHasPermission("CUSTOM", ["leads.view"], "leads.manage"),
    false
  );
});

test("resolved permissions contain implications once and reject unknown values", () => {
  assert.deepEqual(
    resolvePermissions("CUSTOM", [
      "accounts.manage",
      "accounts.view",
      "not-a-permission",
    ]),
    ["accounts.manage", "accounts.view"]
  );
});
