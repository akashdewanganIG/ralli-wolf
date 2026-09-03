/**
 * Registers the full Express app without binding a port, then lists the image
 * endpoints. Catches route-wiring mistakes that type checking cannot see.
 *
 * Run with: npm run verify:image-routes -w api
 */
import { createApp } from "../src/app.js";
import { setupRoutes } from "../src/routes/index.js";

interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
  name?: string;
  handle?: { stack?: Layer[] };
  regexp?: RegExp;
}

function collect(stack: Layer[], prefix = ""): string[] {
  const found: string[] = [];
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods)
        .filter(m => layer.route!.methods[m])
        .map(m => m.toUpperCase())
        .join(",");
      found.push(`${methods.padEnd(6)} ${prefix}${layer.route.path}`);
    } else if (layer.handle?.stack) {
      const source = layer.regexp?.source ?? "";
      const mount = source
        .replace("^\\/", "/")
        .replace("\\/?(?=\\/|$)", "")
        .replace(/\\\//g, "/")
        .replace(/\$$/, "");
      found.push(
        ...collect(layer.handle.stack, mount === "/(?:/)?" ? prefix : prefix)
      );
    }
  }
  return found;
}

const app = createApp();
setupRoutes(app);

const router = (app as unknown as { router?: { stack: Layer[] } }).router;
const stack =
  router?.stack ??
  (app as unknown as { _router: { stack: Layer[] } })._router.stack;

const all = collect(stack);
const imageRoutes = all.filter(r => /image|logo/i.test(r));

console.log("\nApp constructed and all routes registered without error.");
console.log(`Total route handlers: ${all.length}\n`);
console.log("Image endpoints:");
for (const route of imageRoutes.sort()) console.log(`  ${route}`);

const expected = 12;
if (imageRoutes.length < expected) {
  console.log(
    `\nExpected at least ${expected} image endpoints, found ${imageRoutes.length}.`
  );
  process.exit(1);
}
console.log(`\n${imageRoutes.length} image endpoints wired.\n`);
process.exit(0);
