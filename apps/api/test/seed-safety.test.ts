import assert from "node:assert/strict";
import test from "node:test";
import { assertDestructiveDatabaseAllowed } from "../../../packages/db/prisma/seed-safety.js";

const KEYS = [
  "NODE_ENV",
  "ALLOW_DESTRUCTIVE_SEED",
  "DESTRUCTIVE_DATABASE_CONFIRM",
  "DIRECT_URL",
  "DATABASE_URL",
] as const;

test("destructive database operations require environment and exact target confirmation", () => {
  const original = Object.fromEntries(KEYS.map(key => [key, process.env[key]]));
  try {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_DESTRUCTIVE_SEED = "I_UNDERSTAND_THIS_DELETES_DATA";
    process.env.DIRECT_URL =
      "postgresql://user:secret@localhost:5433/ralli_wolf";
    process.env.DESTRUCTIVE_DATABASE_CONFIRM = "localhost:5433/ralli_wolf";
    assert.throws(
      () => assertDestructiveDatabaseAllowed("Test reset"),
      /disabled when NODE_ENV=production/
    );

    process.env.NODE_ENV = "test";
    delete process.env.DESTRUCTIVE_DATABASE_CONFIRM;
    assert.throws(
      () => assertDestructiveDatabaseAllowed("Test reset"),
      /targets localhost:5433\/ralli_wolf/
    );

    process.env.DESTRUCTIVE_DATABASE_CONFIRM = "localhost:5433/other";
    assert.throws(
      () => assertDestructiveDatabaseAllowed("Test reset"),
      /targets localhost:5433\/ralli_wolf/
    );

    process.env.DESTRUCTIVE_DATABASE_CONFIRM = "localhost:5433/ralli_wolf";
    assert.doesNotThrow(() => assertDestructiveDatabaseAllowed("Test reset"));
  } finally {
    for (const key of KEYS) {
      const value = original[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
