import { existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = resolve(repositoryRoot, "apps/web");
const nextBuildPaths = existsSync(webRoot)
  ? readdirSync(webRoot, { withFileTypes: true })
      .filter(
        entry =>
          entry.isDirectory() &&
          (entry.name === ".next" || entry.name.startsWith(".next.stale-"))
      )
      .map(entry => `apps/web/${entry.name}`)
  : [];
const generatedPaths = [
  ".turbo",
  "apps/api/.turbo",
  "apps/api/dist",
  "apps/web/.turbo",
  "packages/db/.turbo",
  "packages/db/dist",
  "packages/ui/.turbo",
  ...nextBuildPaths,
];

for (const generatedPath of generatedPaths) {
  const target = resolve(repositoryRoot, generatedPath);
  if (!target.startsWith(`${repositoryRoot}${sep}`)) {
    throw new Error(
      `Refusing to clean a path outside the repository: ${target}`
    );
  }
  if (!existsSync(target)) continue;

  rmSync(target, { recursive: true, force: true });
  console.info(`Removed ${relative(repositoryRoot, target)}`);
}
