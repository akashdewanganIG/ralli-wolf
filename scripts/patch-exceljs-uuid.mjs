import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve("node_modules", "exceljs", "package.json");
const temporaryPath = `${manifestPath}.ralli-wolf.tmp`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (manifest.version !== "4.4.0") {
  throw new Error(
    `Unsupported ExcelJS version ${String(manifest.version)}; review UUID compatibility before installing`
  );
}

const currentRange = manifest.dependencies?.uuid;
if (currentRange !== "^8.3.0" && currentRange !== "^11.1.1") {
  throw new Error(
    `Unexpected ExcelJS UUID range ${String(currentRange)}; refusing to patch dependency metadata`
  );
}

if (currentRange !== "^11.1.1") {
  manifest.dependencies.uuid = "^11.1.1";
  writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  renameSync(temporaryPath, manifestPath);
}
