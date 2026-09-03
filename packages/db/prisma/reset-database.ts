import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertDestructiveDatabaseAllowed } from "./seed-safety.js";

assertDestructiveDatabaseAllowed("Database reset");

const prismaCli = fileURLToPath(
  new URL("../../../node_modules/prisma/build/index.js", import.meta.url)
);
const result = spawnSync(
  process.execPath,
  [prismaCli, "migrate", "reset", "--force", "--skip-seed"],
  { stdio: "inherit", env: process.env }
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
