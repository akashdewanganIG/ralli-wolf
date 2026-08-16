import { PrismaClient, UomCategory } from "@prisma/client";

/**
 * Reference data for the supply-chain modules.
 *
 * Everything in here is idempotent and non-destructive: it may be run against
 * a production database to bring a new environment up to the baseline, and
 * re-run safely afterwards. It seeds *reference* data only — units, document
 * numbering and tunable settings. It never invents warehouses, suppliers,
 * stock or prices, because those are business records that must come from the
 * customer, not from a seed script.
 */

interface UnitSeed {
  code: string;
  name: string;
  category: UomCategory;
  baseFactor: string;
  isBaseUnit: boolean;
  decimals: number;
}

/**
 * `baseFactor` converts one of this unit into the category's base unit
 * (EA, KG, M, L, M2, HR), which is what makes cross-unit arithmetic exact.
 */
const UNITS: UnitSeed[] = [
  {
    code: "EA",
    name: "Each",
    category: UomCategory.COUNT,
    baseFactor: "1",
    isBaseUnit: true,
    decimals: 0,
  },
  {
    code: "PC",
    name: "Piece",
    category: UomCategory.COUNT,
    baseFactor: "1",
    isBaseUnit: false,
    decimals: 0,
  },
  {
    code: "PR",
    name: "Pair",
    category: UomCategory.COUNT,
    baseFactor: "2",
    isBaseUnit: false,
    decimals: 0,
  },
  {
    code: "DZ",
    name: "Dozen",
    category: UomCategory.COUNT,
    baseFactor: "12",
    isBaseUnit: false,
    decimals: 0,
  },
  {
    code: "BOX",
    name: "Box",
    category: UomCategory.COUNT,
    baseFactor: "1",
    isBaseUnit: false,
    decimals: 0,
  },
  {
    code: "CTN",
    name: "Carton",
    category: UomCategory.COUNT,
    baseFactor: "1",
    isBaseUnit: false,
    decimals: 0,
  },
  {
    code: "PLT",
    name: "Pallet",
    category: UomCategory.COUNT,
    baseFactor: "1",
    isBaseUnit: false,
    decimals: 0,
  },
  {
    code: "SET",
    name: "Set",
    category: UomCategory.COUNT,
    baseFactor: "1",
    isBaseUnit: false,
    decimals: 0,
  },
  {
    code: "ROLL",
    name: "Roll",
    category: UomCategory.COUNT,
    baseFactor: "1",
    isBaseUnit: false,
    decimals: 0,
  },

  {
    code: "KG",
    name: "Kilogram",
    category: UomCategory.WEIGHT,
    baseFactor: "1",
    isBaseUnit: true,
    decimals: 3,
  },
  {
    code: "G",
    name: "Gram",
    category: UomCategory.WEIGHT,
    baseFactor: "0.001",
    isBaseUnit: false,
    decimals: 2,
  },
  {
    code: "MG",
    name: "Milligram",
    category: UomCategory.WEIGHT,
    baseFactor: "0.000001",
    isBaseUnit: false,
    decimals: 2,
  },
  {
    code: "TON",
    name: "Metric Tonne",
    category: UomCategory.WEIGHT,
    baseFactor: "1000",
    isBaseUnit: false,
    decimals: 4,
  },
  {
    code: "LB",
    name: "Pound",
    category: UomCategory.WEIGHT,
    baseFactor: "0.453592",
    isBaseUnit: false,
    decimals: 3,
  },

  {
    code: "M",
    name: "Metre",
    category: UomCategory.LENGTH,
    baseFactor: "1",
    isBaseUnit: true,
    decimals: 3,
  },
  {
    code: "MM",
    name: "Millimetre",
    category: UomCategory.LENGTH,
    baseFactor: "0.001",
    isBaseUnit: false,
    decimals: 1,
  },
  {
    code: "CM",
    name: "Centimetre",
    category: UomCategory.LENGTH,
    baseFactor: "0.01",
    isBaseUnit: false,
    decimals: 2,
  },
  {
    code: "IN",
    name: "Inch",
    category: UomCategory.LENGTH,
    baseFactor: "0.0254",
    isBaseUnit: false,
    decimals: 3,
  },
  {
    code: "FT",
    name: "Foot",
    category: UomCategory.LENGTH,
    baseFactor: "0.3048",
    isBaseUnit: false,
    decimals: 3,
  },

  {
    code: "L",
    name: "Litre",
    category: UomCategory.VOLUME,
    baseFactor: "1",
    isBaseUnit: true,
    decimals: 3,
  },
  {
    code: "ML",
    name: "Millilitre",
    category: UomCategory.VOLUME,
    baseFactor: "0.001",
    isBaseUnit: false,
    decimals: 1,
  },
  {
    code: "M3",
    name: "Cubic Metre",
    category: UomCategory.VOLUME,
    baseFactor: "1000",
    isBaseUnit: false,
    decimals: 4,
  },

  {
    code: "M2",
    name: "Square Metre",
    category: UomCategory.AREA,
    baseFactor: "1",
    isBaseUnit: true,
    decimals: 4,
  },
  {
    code: "HR",
    name: "Hour",
    category: UomCategory.TIME,
    baseFactor: "1",
    isBaseUnit: true,
    decimals: 2,
  },
  {
    code: "MIN",
    name: "Minute",
    category: UomCategory.TIME,
    baseFactor: "0.016667",
    isBaseUnit: false,
    decimals: 2,
  },
];

interface SequenceSeed {
  key: string;
  prefix: string;
  padding: number;
  resetPeriod: "NONE" | "YEARLY" | "MONTHLY";
}

/**
 * Document numbering. Seeding the rows up front means the first document of
 * each kind does not pay the cost of creating its sequence, and an
 * administrator can change a prefix before go-live without touching code.
 */
const SEQUENCES: SequenceSeed[] = [
  { key: "STOCK_MOVEMENT", prefix: "MOV", padding: 7, resetPeriod: "YEARLY" },
  { key: "STOCK_LOT", prefix: "LOT", padding: 7, resetPeriod: "YEARLY" },
  { key: "STOCK_COUNT", prefix: "CNT", padding: 5, resetPeriod: "YEARLY" },
  { key: "PUTAWAY_TASK", prefix: "PUT", padding: 6, resetPeriod: "YEARLY" },
  { key: "PICK_LIST", prefix: "PCK", padding: 6, resetPeriod: "YEARLY" },
  { key: "PACKAGE", prefix: "PKG", padding: 6, resetPeriod: "YEARLY" },
  { key: "PALLET", prefix: "PLT", padding: 6, resetPeriod: "NONE" },
  { key: "BOM", prefix: "BOM", padding: 5, resetPeriod: "NONE" },
  { key: "SUPPLIER", prefix: "SUP", padding: 5, resetPeriod: "NONE" },
  {
    key: "PURCHASE_REQUISITION",
    prefix: "PR",
    padding: 5,
    resetPeriod: "YEARLY",
  },
  { key: "PURCHASE_ORDER", prefix: "PO", padding: 5, resetPeriod: "YEARLY" },
  { key: "GOODS_RECEIPT", prefix: "GRN", padding: 5, resetPeriod: "YEARLY" },
  { key: "QUALITY_CHECK", prefix: "QC", padding: 5, resetPeriod: "YEARLY" },
  {
    key: "MATERIAL_REQUISITION",
    prefix: "MR",
    padding: 5,
    resetPeriod: "YEARLY",
  },
  { key: "PRODUCTION_ORDER", prefix: "PRO", padding: 5, resetPeriod: "YEARLY" },
];

/**
 * Tunables the alert engine reads at run time. They are stored as global
 * settings so an administrator can change them from the Settings screen
 * rather than needing a deployment.
 */
const SETTINGS: Array<{ key: string; value: string; description: string }> = [
  {
    key: "inventory.expiry_warning_days",
    value: "30",
    description:
      "How many days before a lot expires an expiry warning is raised",
  },
  {
    key: "inventory.alert_notify_roles",
    value: "ADMIN",
    description:
      "Comma-separated roles that receive in-app stock alert notifications",
  },
  {
    key: "inventory.auto_requisition_enabled",
    value: "true",
    description:
      "Master switch for automatic purchase requisitions. Individual items still need autoRequisition set on their reorder rule.",
  },
];

export async function seedSupplyChainReference(
  prisma: PrismaClient
): Promise<void> {
  for (const unit of UNITS) {
    await prisma.unitOfMeasure.upsert({
      where: { code: unit.code },
      // Only the descriptive fields are refreshed. `baseFactor` is left alone
      // on an existing row, because changing a conversion factor under live
      // stock would silently restate quantities already recorded.
      update: {
        name: unit.name,
        category: unit.category,
        decimals: unit.decimals,
        isBaseUnit: unit.isBaseUnit,
      },
      create: {
        code: unit.code,
        name: unit.name,
        category: unit.category,
        baseFactor: unit.baseFactor,
        isBaseUnit: unit.isBaseUnit,
        decimals: unit.decimals,
      },
    });
  }

  for (const sequence of SEQUENCES) {
    await prisma.numberSequence.upsert({
      where: { key: sequence.key },
      // A live counter is never reset by re-seeding.
      update: {},
      create: {
        key: sequence.key,
        prefix: sequence.prefix,
        padding: sequence.padding,
        resetPeriod: sequence.resetPeriod,
        lastValue: 0,
      },
    });
  }

  for (const setting of SETTINGS) {
    await prisma.globalSetting.upsert({
      where: { key: setting.key },
      // An administrator's chosen value wins over the seed default.
      update: { description: setting.description },
      create: setting,
    });
  }

  console.log(
    `📦 Supply chain reference data ready: ${UNITS.length} units of measure, ${SEQUENCES.length} document sequences, ${SETTINGS.length} settings`
  );
}

/**
 * Delete supply-chain transactional data in foreign-key-safe order.
 * Used by the destructive development seed before it clears users and
 * products, which those tables reference.
 */
export async function resetSupplyChainData(
  prisma: PrismaClient
): Promise<void> {
  await prisma.productionOrderConsumption.deleteMany({});
  await prisma.materialRequisitionLine.deleteMany({});
  await prisma.materialRequisition.deleteMany({});
  await prisma.productionOrderComponent.deleteMany({});
  await prisma.productionOrder.deleteMany({});

  await prisma.packageLine.deleteMany({});
  await prisma.package.deleteMany({});
  await prisma.pickTask.deleteMany({});
  await prisma.pickList.deleteMany({});
  await prisma.putawayTask.deleteMany({});

  await prisma.stockCountLine.deleteMany({});
  await prisma.stockCount.deleteMany({});

  await prisma.qualityCheckParameter.deleteMany({});
  await prisma.qualityCheck.deleteMany({});
  await prisma.goodsReceiptLine.deleteMany({});
  await prisma.goodsReceiptNote.deleteMany({});

  await prisma.purchaseOrderLine.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.purchaseRequisitionLine.deleteMany({});
  await prisma.purchaseRequisition.deleteMany({});

  await prisma.stockAlert.deleteMany({});
  await prisma.reorderRule.deleteMany({});
  await prisma.stockReservation.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.stockBalance.deleteMany({});
  await prisma.stockLot.deleteMany({});

  await prisma.supplierPriceTier.deleteMany({});
  await prisma.supplierProduct.deleteMany({});
  await prisma.supplierContact.deleteMany({});
  await prisma.supplierPerformance.deleteMany({});
  await prisma.supplier.deleteMany({});

  await prisma.pallet.deleteMany({});
  await prisma.storageBin.deleteMany({});
  await prisma.warehouseZone.deleteMany({});
  await prisma.warehouse.deleteMany({});

  await prisma.bomChangeLog.deleteMany({});
  await prisma.bomComponentSubstitute.deleteMany({});
  await prisma.bomComponent.deleteMany({});
  await prisma.billOfMaterials.deleteMany({});
}

// Allow running this file directly: `npm run prisma:seed:supply-chain`
const isDirectRun = process.argv[1]
  ?.replace(/\\/g, "/")
  .endsWith("seed-supply-chain.ts");
if (isDirectRun) {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
    },
  });

  seedSupplyChainReference(prisma)
    .then(() => console.log("✅ Supply chain reference data seeded"))
    .catch(error => {
      console.error("❌ Failed to seed supply chain reference data:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
