/**
 * Confirms the generated Prisma client exposes the image models and reports
 * whether the backing tables exist yet.
 *
 * Run with: npm run verify:image-schema -w api
 */
import { prisma } from "@repo/db";

type AnyClient = Record<string, { findMany?: (args?: unknown) => unknown }>;

async function main() {
  const client = prisma as unknown as AnyClient;

  console.log("\nPrisma client delegates");
  for (const name of [
    "productImage",
    "goodsReceiptImage",
    "qualityCheckImage",
    "warehouseImage",
  ]) {
    const ok = typeof client[name]?.findMany === "function";
    console.log(`  prisma.${name.padEnd(20)} ${ok ? "available" : "MISSING"}`);
  }

  console.log("\nDatabase tables");
  const probes: Array<[string, () => Promise<unknown>]> = [
    ["product_images", () => client.productImage!.findMany!({ take: 1 })],
    [
      "goods_receipt_images",
      () => client.goodsReceiptImage!.findMany!({ take: 1 }),
    ],
    [
      "quality_check_images",
      () => client.qualityCheckImage!.findMany!({ take: 1 }),
    ],
    [
      "suppliers.logo_url",
      () => prisma.supplier.findFirst({ select: { id: true, logoUrl: true } }),
    ],
  ];

  for (const [label, run] of probes) {
    try {
      await run();
      console.log(`  ${label.padEnd(22)} present`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const missing = /does not exist|Unknown argument|column/i.test(message);
      console.log(
        `  ${label.padEnd(22)} ${missing ? "NOT CREATED — migration pending" : "error"}`
      );
    }
  }

  await prisma.$disconnect();
  console.log("");
}

main().catch(async error => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
