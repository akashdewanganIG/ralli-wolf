import { PrismaClient } from "@prisma/client";
import nodeCrypto from "node:crypto";

/**
 * Presentation dataset for Ralli Wolf Operations.
 *
 * This is the dataset shown to a client, so every string reads like a real
 * record: real product families (angle grinders, rotary hammers), Indian
 * suppliers and customers, and document numbers in the format the application
 * itself generates. Nothing is prefixed "DEMO" — the point is that no screen
 * looks like filler.
 *
 * Destructive by design: it clears every business table and rebuilds them, so
 * the demo is identical every time it runs. Five things are preserved:
 *
 *   users              sign-in must keep working
 *   currencies         the display-currency picker reads them
 *   units_of_measure   products cannot exist without them
 *   number_sequences   document numbering continues from where it was
 *   global_settings    workspace configuration, incl. the default currency
 *
 * Run with: pnpm --filter @repo/db prisma:seed:presentation
 */
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
  },
});

// Prisma generates a distinct type per delegate; keeping the plumbing dynamic
// keeps this readable while Prisma still validates every field at runtime.
const db = prisma as any;

const NOW = new Date();
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const ago = (n: number) => days(-n);
const money = (n: number) => n.toFixed(2);
const qty = (n: number) => n.toFixed(4);

const PRESERVE = new Set([
  "_prisma_migrations",
  "users",
  "currencies",
  "units_of_measure",
  "number_sequences",
  "global_settings",
  "app_config",
]);

/** Innovun Global colleagues, used as the customer-side people. */
const PEOPLE: [string, string][] = [
  ["Nisha", "Dudi"],
  ["Pragya", "Awasthi"],
  ["Pushkaraj", "Shirgurkar"],
  ["Rajeev", "Dewangan"],
  ["Rishabh", "Patidar"],
  ["Shubham", "Sarvaiya"],
  ["Simran", "Jadhav"],
  ["Suraj", "Jethwa"],
  ["Arpitha", "Sudheer"],
  ["Gayathri", "Sridhar"],
  ["Gitesh", "Sarvaiya"],
  ["Kimberly", "Dias"],
  ["Neetha", "Vasudevan"],
  ["Nilima", "Sahu"],
  ["Yeshika", "Singhvi"],
];
const slug = (f: string, l: string) =>
  `${f}.${l}`.toLowerCase().replace(/[^a-z.]/g, "");

/**
 * Mirrors the API's `encryptSecret`, so seeded WhatsApp credentials decrypt
 * with the same ENCRYPTION_KEY the running server uses. The key material is a
 * placeholder — it only has to be well-formed, not a live MSG91 key.
 */
function encryptSecret(plainText: string) {
  const raw = process.env.ENCRYPTION_KEY || "";
  const key = raw.length === 64 ? Buffer.from(raw, "hex") : nodeCrypto.createHash("sha256").update(raw).digest();
  const iv = nodeCrypto.randomBytes(12);
  const cipher = nodeCrypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return {
    cipherText: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

async function wipe() {
  const rows: { table: string }[] = await prisma.$queryRawUnsafe(
    `SELECT tablename AS table FROM pg_tables WHERE schemaname = 'public'`
  );
  const targets = rows
    .map(r => r.table)
    .filter(t => !PRESERVE.has(t))
    .map(t => `"public"."${t}"`);
  if (!targets.length) return;
  // One statement, so foreign keys never dictate the order.
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${targets.join(", ")} RESTART IDENTITY CASCADE`
  );
  console.log(`  cleared ${targets.length} tables`);
}

async function main() {
  console.log("Ralli Wolf — presentation dataset\nclearing business tables…");
  await wipe();

  const users = await prisma.user.findMany({
    select: { id: true, firstName: true, lastName: true, role: true },
    orderBy: { id: "asc" },
  });
  if (!users.length) throw new Error("No users found — cannot attribute records.");
  const admin = users.find(u => u.role === "ADMIN") ?? users[0]!;
  const pick = (i: number) => users[Math.abs(i) % users.length]!;

  const uoms = await prisma.unitOfMeasure.findMany();
  const uom = (code: string) => uoms.find(u => u.code === code)?.id ?? null;

  // ---------------------------------------------------------------- catalogue
  console.log("catalogue…");
  const categories: Record<string, number> = {};
  for (const [name, description] of [
    ["Power Tools", "Corded tools sold under the Ralli Wolf brand"],
    ["Spare Parts", "Service parts stocked for warranty and after-sales repair"],
    ["Raw Materials", "Copper, steel and polymer inputs consumed in production"],
    ["Consumables", "Greases, adhesives and shop-floor consumables"],
    ["Packaging", "Cartons, inserts and printed literature"],
  ] as [string, string][]) {
    const c = await db.productCategory.create({ data: { name, description } });
    categories[name] = c.id;
  }

  type P = {
    code: string; name: string; cat: string; itemType: string; cost: number;
    uom: string; hsn: string; tracking?: string; mfg?: boolean; buy?: boolean;
    sell?: boolean; shelf?: number; kg?: number;
  };
  const specs: P[] = [
    { code: "RW-AG4-800", name: "Angle Grinder 100 mm 800 W", cat: "Power Tools", itemType: "FINISHED_GOOD", cost: 2450, uom: "EA", hsn: "84672900", mfg: true, sell: true, tracking: "SERIAL", kg: 1.8 },
    { code: "RW-AG5-1200", name: "Angle Grinder 125 mm 1200 W", cat: "Power Tools", itemType: "FINISHED_GOOD", cost: 3180, uom: "EA", hsn: "84672900", mfg: true, sell: true, tracking: "SERIAL", kg: 2.4 },
    { code: "RW-DR13-650", name: "Impact Drill 13 mm 650 W", cat: "Power Tools", itemType: "FINISHED_GOOD", cost: 2120, uom: "EA", hsn: "84672100", mfg: true, sell: true, tracking: "SERIAL", kg: 1.9 },
    { code: "RW-HD26-800", name: "Rotary Hammer 26 mm 800 W", cat: "Power Tools", itemType: "FINISHED_GOOD", cost: 5640, uom: "EA", hsn: "84672100", mfg: true, sell: true, tracking: "SERIAL", kg: 3.1 },
    { code: "RW-CS7-1400", name: "Circular Saw 185 mm 1400 W", cat: "Power Tools", itemType: "FINISHED_GOOD", cost: 4980, uom: "EA", hsn: "84672900", mfg: true, sell: true, tracking: "SERIAL", kg: 3.6 },
    { code: "RW-BL-600", name: "Air Blower 600 W", cat: "Power Tools", itemType: "FINISHED_GOOD", cost: 1640, uom: "EA", hsn: "84145930", mfg: true, sell: true, kg: 1.4 },
    { code: "RW-PS-710", name: "Polisher / Sander 180 mm 710 W", cat: "Power Tools", itemType: "FINISHED_GOOD", cost: 3860, uom: "EA", hsn: "84672900", mfg: true, sell: true, kg: 2.9 },

    { code: "CMP-ARM-800", name: "Armature Assembly 800 W", cat: "Spare Parts", itemType: "COMPONENT", cost: 640, uom: "EA", hsn: "85030090", buy: true, sell: true, tracking: "BATCH" },
    { code: "CMP-STA-800", name: "Stator Winding 800 W", cat: "Spare Parts", itemType: "COMPONENT", cost: 520, uom: "EA", hsn: "85030090", buy: true, sell: true, tracking: "BATCH" },
    { code: "CMP-CRB-01", name: "Carbon Brush Set (pair)", cat: "Spare Parts", itemType: "SPARE_PART", cost: 48, uom: "PR", hsn: "85452000", buy: true, sell: true },
    { code: "CMP-BRG-6001", name: "Ball Bearing 6001 ZZ", cat: "Spare Parts", itemType: "COMPONENT", cost: 62, uom: "EA", hsn: "84821011", buy: true, sell: true, tracking: "BATCH" },
    { code: "CMP-GEA-M8", name: "Spiral Bevel Gear Pair M8", cat: "Spare Parts", itemType: "COMPONENT", cost: 290, uom: "SET", hsn: "84836090", buy: true, sell: true },
    { code: "CMP-HSG-AG4", name: "Housing Assembly — AG4", cat: "Spare Parts", itemType: "COMPONENT", cost: 185, uom: "EA", hsn: "39269099", buy: true },
    { code: "CMP-SW-10A", name: "Trigger Switch 10 A", cat: "Spare Parts", itemType: "COMPONENT", cost: 74, uom: "EA", hsn: "85365090", buy: true, sell: true },
    { code: "CMP-CBL-2M", name: "Power Cable 2 m 3-core", cat: "Spare Parts", itemType: "COMPONENT", cost: 96, uom: "EA", hsn: "85444999", buy: true },
    { code: "CMP-GRD-100", name: "Wheel Guard 100 mm", cat: "Spare Parts", itemType: "SPARE_PART", cost: 58, uom: "EA", hsn: "84669390", buy: true, sell: true },

    { code: "RM-CU-WIRE", name: "Enamelled Copper Wire 0.45 mm", cat: "Raw Materials", itemType: "RAW_MATERIAL", cost: 840, uom: "KG", hsn: "85441110", buy: true, tracking: "BATCH" },
    { code: "RM-STL-SHEET", name: "CRCA Steel Sheet 1.2 mm", cat: "Raw Materials", itemType: "RAW_MATERIAL", cost: 68, uom: "KG", hsn: "72091690", buy: true, tracking: "BATCH" },
    { code: "RM-ABS-GRAN", name: "ABS Granules — Natural", cat: "Raw Materials", itemType: "RAW_MATERIAL", cost: 152, uom: "KG", hsn: "39033000", buy: true, tracking: "BATCH" },
    { code: "RM-ALU-DIE", name: "Aluminium Die-Cast Blank", cat: "Raw Materials", itemType: "RAW_MATERIAL", cost: 212, uom: "KG", hsn: "76169990", buy: true, tracking: "BATCH" },

    { code: "CON-GRS-EP2", name: "Lithium Grease EP2 — 500 g", cat: "Consumables", itemType: "CONSUMABLE", cost: 310, uom: "EA", hsn: "27101990", buy: true, tracking: "BATCH", shelf: 540 },
    { code: "CON-ADH-401", name: "Threadlocker Adhesive 401", cat: "Consumables", itemType: "CONSUMABLE", cost: 480, uom: "EA", hsn: "35061000", buy: true, tracking: "BATCH", shelf: 365 },
    { code: "PKG-BOX-AG4", name: "Printed Carton — AG4", cat: "Packaging", itemType: "PACKAGING", cost: 34, uom: "EA", hsn: "48191010", buy: true },
    { code: "PKG-BOX-HD26", name: "Printed Carton — HD26", cat: "Packaging", itemType: "PACKAGING", cost: 46, uom: "EA", hsn: "48191010", buy: true },
  ];

  const products: Record<string, any> = {};
  for (const s of specs) {
    products[s.code] = await db.product.create({
      data: {
        code: s.code, name: s.name, description: `${s.name} — Ralli Wolf`,
        categoryId: categories[s.cat], active: true,
        component: s.itemType !== "FINISHED_GOOD",
        itemType: s.itemType, uomId: uom(s.uom),
        trackingType: s.tracking ?? "NONE",
        valuationMethod: "FIFO",
        pickingStrategy: s.shelf ? "FEFO" : "FIFO",
        shelfLifeDays: s.shelf ?? null,
        standardCost: money(s.cost), hsnCode: s.hsn,
        weightKg: s.kg ? qty(s.kg) : null,
        isPurchasable: s.buy ?? false, isSellable: s.sell ?? false,
        isManufactured: s.mfg ?? false, isStockTracked: true,
      },
    });
  }
  console.log(`  ${specs.length} products in 5 categories`);

  // ------------------------------------------------------- warehouse network
  console.log("warehouse network…");
  const whSpecs = [
    { code: "MUM-PLANT", name: "Ralli Wolf Plant — Andheri", type: "PLANT", city: "Mumbai", state: "Maharashtra", pin: "400093" },
    { code: "MUM-FG", name: "Finished Goods Store — Bhiwandi", type: "WAREHOUSE", city: "Bhiwandi", state: "Maharashtra", pin: "421302" },
    { code: "PUN-DC", name: "Pune Distribution Centre", type: "WAREHOUSE", city: "Pune", state: "Maharashtra", pin: "411018" },
    { code: "BLR-DEP", name: "Bengaluru Service Depot", type: "STORE", city: "Bengaluru", state: "Karnataka", pin: "560058" },
  ];
  const warehouses: Record<string, any> = {};
  const bins: Record<string, any[]> = {};
  for (let w = 0; w < whSpecs.length; w++) {
    const s = whSpecs[w]!;
    const wh = await db.warehouse.create({
      data: {
        code: s.code, name: s.name, type: s.type, isActive: true,
        isDefault: w === 0,
        addressLine1: `Plot ${10 + w}, MIDC Industrial Area`,
        city: s.city, state: s.state, postalCode: s.pin, country: "India",
        contactName: `${PEOPLE[w]![0]} ${PEOPLE[w]![1]}`,
        contactPhone: `9${String(820000000 + w * 111111).slice(0, 9)}`,
        contactEmail: `stores.${s.code.toLowerCase()}@ralliwolf.in`,
        gstNumber: `27AAACR${2000 + w}L1Z${w}`,
      },
    });
    warehouses[s.code] = wh;
    bins[s.code] = [];

    const zones = [
      { code: "RCV", name: "Receiving Dock", zoneType: "RECEIVING" },
      { code: "STO", name: "Bulk Storage", zoneType: "STORAGE" },
      { code: "PIC", name: "Pick Face", zoneType: "PICKING" },
      { code: "PAK", name: "Packing Bench", zoneType: "PACKING" },
      { code: "QAR", name: "Quarantine Cage", zoneType: "QUARANTINE" },
      ...(s.type === "PLANT" ? [{ code: "PRD", name: "Production Line", zoneType: "PRODUCTION" }] : []),
    ];
    for (const z of zones) {
      const zone = await db.warehouseZone.create({
        data: { warehouseId: wh.id, code: z.code, name: z.name, zoneType: z.zoneType, isActive: true },
      });
      const count = z.zoneType === "STORAGE" ? 6 : z.zoneType === "PICKING" ? 4 : 2;
      for (let i = 1; i <= count; i++) {
        bins[s.code]!.push(
          await db.storageBin.create({
            data: {
              warehouseId: wh.id, zoneId: zone.id,
              code: `${z.code}-${String(i).padStart(2, "0")}`,
              aisle: z.code, rack: String(Math.ceil(i / 2)),
              level: String(((i - 1) % 2) + 1), position: String(i),
              binType: z.zoneType === "STORAGE" ? "PALLET_RACK" : "SHELF",
              pickSequence: i, isActive: true,
              isPickFace: z.zoneType === "PICKING",
              isReceiving: z.zoneType === "RECEIVING",
              isShipping: z.zoneType === "PACKING",
              isQuarantine: z.zoneType === "QUARANTINE",
              maxWeightKg: qty(500),
            },
          })
        );
      }
    }
    for (let i = 1; i <= 3; i++) {
      await db.pallet.create({
        data: {
          code: `PLT-${s.code}-${String(i).padStart(3, "0")}`,
          warehouseId: wh.id,
          status: i === 1 ? "IN_USE" : i === 2 ? "STAGED" : "EMPTY",
          grossWeightKg: i === 1 ? qty(240) : null,
        },
      });
    }
  }
  const binIn = (wh: string, zone: string) => bins[wh]!.find(b => b.code.startsWith(zone))!;
  console.log(`  ${whSpecs.length} warehouses, ${Object.values(bins).flat().length} bins`);

  // ---------------------------------------------------------------- suppliers
  console.log("suppliers…");
  const supSpecs = [
    { code: "SUP-00001", name: "Bharat Electricals & Windings", city: "Pune", state: "Maharashtra", lead: 12, days: 30, items: ["CMP-ARM-800", "CMP-STA-800", "RM-CU-WIRE"] },
    { code: "SUP-00002", name: "Precision Bearings India", city: "Rajkot", state: "Gujarat", lead: 9, days: 45, items: ["CMP-BRG-6001", "CMP-GEA-M8"] },
    { code: "SUP-00003", name: "Shakti Polymers", city: "Vapi", state: "Gujarat", lead: 7, days: 30, items: ["RM-ABS-GRAN", "CMP-HSG-AG4"] },
    { code: "SUP-00004", name: "Gujarat Steel Traders", city: "Ahmedabad", state: "Gujarat", lead: 14, days: 60, items: ["RM-STL-SHEET", "RM-ALU-DIE"] },
    { code: "SUP-00005", name: "Nova Packaging Solutions", city: "Bhiwandi", state: "Maharashtra", lead: 5, days: 15, items: ["PKG-BOX-AG4", "PKG-BOX-HD26"] },
    { code: "SUP-00006", name: "Deccan Electricals & Switchgear", city: "Hyderabad", state: "Telangana", lead: 10, days: 30, items: ["CMP-SW-10A", "CMP-CBL-2M"] },
    { code: "SUP-00007", name: "Sundaram Lubricants", city: "Chennai", state: "Tamil Nadu", lead: 8, days: 30, items: ["CON-GRS-EP2", "CON-ADH-401"] },
  ];
  const suppliers: Record<string, any> = {};
  for (let i = 0; i < supSpecs.length; i++) {
    const s = supSpecs[i]!;
    const host = s.name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 16);
    const sup = await db.supplier.create({
      data: {
        code: s.code, name: s.name, legalName: `${s.name} Pvt Ltd`, status: "ACTIVE",
        email: `sales@${host}.co.in`, phone: `9${String(870000000 + i * 1111111).slice(0, 9)}`,
        website: `https://www.${host}.co.in`,
        gstNumber: `27AABC${1000 + i}K1Z${i}`, panNumber: `AABC${1000 + i}K`,
        addressLine1: `Unit ${4 + i}, MIDC Phase II`, city: s.city, state: s.state,
        postalCode: "411018", country: "India", currencyCode: "INR",
        paymentTerms: `${s.days} days net`, creditDays: s.days,
        incoterms: "FOB", leadTimeDays: s.lead, minOrderValue: money(25000),
        bankName: "HDFC Bank", bankIfsc: "HDFC0001234",
        notes: `Approved vendor. Last audited ${ago(120).toISOString().slice(0, 10)}.`,
        createdById: admin.id,
      },
    });
    suppliers[s.code] = sup;

    const [f, l] = PEOPLE[i % PEOPLE.length]!;
    await db.supplierContact.create({
      data: {
        supplierId: sup.id, name: `${f} ${l}`, designation: "Key Account Manager",
        email: `${slug(f, l)}@${host}.co.in`,
        phone: `9${String(910000000 + i * 1234321).slice(0, 9)}`, isPrimary: true,
      },
    });

    for (const code of s.items) {
      const p = products[code];
      const sp = await db.supplierProduct.create({
        data: {
          supplierId: sup.id, productId: p.id,
          supplierSku: `${s.code.slice(-3)}-${code.split("-").pop()}`,
          unitPrice: money(Number(p.standardCost)), currencyCode: "INR",
          minOrderQuantity: qty(50), packSize: qty(10), leadTimeDays: s.lead,
          validFrom: ago(200), isPreferred: true, isActive: true,
        },
      });
      await db.supplierPriceTier.create({
        data: { supplierProductId: sp.id, minQuantity: qty(500), unitPrice: money(Number(p.standardCost) * 0.94) },
      });
    }

    // Three quarters of history, so the scorecard charts have a series.
    for (let m = 3; m >= 1; m--) {
      const orders = 6 + m * 2;
      const receipts = 5 + m * 2;
      const onTime = receipts - (i % 3);
      await db.supplierPerformance.create({
        data: {
          supplierId: sup.id, periodStart: ago(m * 90), periodEnd: ago((m - 1) * 90 + 1),
          totalOrders: orders, totalOrderValue: money(180000 + m * 45000),
          receiptsCount: receipts, onTimeReceipts: onTime, lateReceipts: receipts - onTime,
          onTimeDeliveryRate: money((onTime / receipts) * 100),
          receivedQuantity: qty(2400 + m * 300), acceptedQuantity: qty(2350 + m * 300),
          rejectedQuantity: qty(50), qualityAcceptanceRate: money(97 + (i % 3)),
          averageLeadTimeDays: money(s.lead + (i % 3)),
          priceVariancePercent: money(((i % 5) - 2) * 0.8),
          fillRate: money(94 + (i % 6)), overallScore: money(88 + ((i + m) % 10)),
          computedAt: ago((m - 1) * 90),
        },
      });
    }
  }
  console.log(`  ${supSpecs.length} suppliers with catalogues and scorecards`);

  await customers({ db, users, admin, pick, products, warehouses, bins, binIn, suppliers });
}

// ---------------------------------------------------------------------------

async function customers(ctx: any) {
  const { db, admin, pick } = ctx;
  console.log("customers and leads…");

  const accountSpecs: [string, string, string][] = [
    ["Larsen Toolworks Pvt Ltd", "Engineering", "larsentoolworks.co.in"],
    ["Godrej Interio Contracts", "Furniture Manufacturing", "godrejinterio-contracts.in"],
    ["Kirloskar Fabrication Works", "Heavy Fabrication", "kirloskarfab.co.in"],
    ["Ashok Leyland Spares Division", "Automotive", "alspares.in"],
    ["JSW Steel — Maintenance Stores", "Steel", "jsw-maintenance.in"],
    ["Mahindra Construction Equipment", "Construction", "mahindra-ce.in"],
    ["Bosch Service Partners India", "Service Network", "boschpartners.in"],
    ["Tata Projects — Site Services", "Infrastructure", "tataprojects-site.in"],
  ];
  const accounts: any[] = [];
  for (const [name, industry, domain] of accountSpecs) {
    accounts.push(await db.account.create({ data: { name, industry, website: `https://www.${domain}` } }));
  }

  const cities = ["Mumbai", "Pune", "Bengaluru", "Chennai", "Ahmedabad", "Nagpur"];
  const states = ["Maharashtra", "Maharashtra", "Karnataka", "Tamil Nadu", "Gujarat", "Maharashtra"];
  const pins = ["400093", "411018", "560058", "600032", "380015", "440016"];
  const roles = ["Purchase Manager", "Maintenance Head", "Stores In-charge", "Procurement Lead", "Plant Engineer"];

  const contacts: any[] = [];
  for (let i = 0; i < PEOPLE.length; i++) {
    const [f, l] = PEOPLE[i]!;
    contacts.push(
      await db.contact.create({
        data: {
          accountId: accounts[i % accounts.length]!.id,
          name: `${f} ${l}`,
          email: `${slug(f, l)}@${accountSpecs[i % accountSpecs.length]![2]}`,
          phone: `9${String(700000000 + i * 1234567).slice(0, 9)}`,
          position: roles[i % roles.length], countryCode: "91",
          city: cities[i % 6], state: states[i % 6], pincode: pins[i % 6],
        },
      })
    );
  }

  const leadCompanies = [
    "Sterling Engineering Works", "Vertex Infra Projects", "Anand Auto Components",
    "Shree Ganesh Fabricators", "Precision Die Casting Co", "Metro Rail Contractors",
    "Coastal Shipyard Services", "Prime Modular Interiors", "Sunrise Solar EPC",
    "Deccan Tool Room", "Nagpur Heavy Machining", "Surat Textile Engineering",
  ];
  const statuses = ["OPEN", "WORKING", "QUALIFIED", "NURTURING", "UNQUALIFIED"];
  const sources = ["LANDING_PAGE", "MANUAL", "IMPORT"];
  const leads: any[] = [];
  for (let i = 0; i < 24; i++) {
    const [f, l] = PEOPLE[i % PEOPLE.length]!;
    const company = leadCompanies[i % leadCompanies.length]!;
    const assigned = i % 3 !== 0; // a third stay unassigned, for that queue
    leads.push(
      await db.lead.create({
        data: {
          firstName: f,
          lastName: i < PEOPLE.length ? l : `${l} ${String.fromCharCode(65 + (i % 26))}`,
          email: `${slug(f, l)}${i}@${company.toLowerCase().replace(/[^a-z]/g, "").slice(0, 14)}.in`,
          phone: `9${String(810000000 + i * 987654).slice(0, 9)}`,
          companyName: company, status: statuses[i % statuses.length],
          source: sources[i % sources.length],
          ownerId: assigned ? pick(i).id : null,
          assignedAt: assigned ? ago(i + 2) : null,
          score: 40 + ((i * 7) % 55), qualityScore: 50 + ((i * 5) % 45),
          completenessScore: 60 + ((i * 3) % 35), countryCode: "91",
          city: cities[i % 6], state: states[i % 6], pincode: pins[i % 6],
          createdAt: ago(30 - i),
        },
      })
    );
  }
  console.log(`  ${accounts.length} accounts, ${contacts.length} contacts, ${leads.length} leads`);

  await pipeline({ ...ctx, accounts, contacts, leads, accountSpecs });
}

async function pipeline(ctx: any) {
  const { db, admin, pick, products, accounts, contacts } = ctx;
  console.log("price books and sales pipeline…");

  const sellable = (Object.values(products) as any[]).filter(p => p.isSellable);
  const books: any[] = [];
  for (const pb of [
    { name: "Standard List Price 2026", mult: 1 },
    { name: "Distributor Price — West", mult: 0.86 },
    { name: "Institutional Tender Price", mult: 0.78 },
  ]) {
    const book = await db.priceBook.create({
      data: {
        name: pb.name, currencyCode: "INR", isActive: true,
        description: `${pb.name} — effective ${ago(60).toISOString().slice(0, 10)}`,
      },
    });
    books.push(book);
    for (const p of sellable) {
      await db.priceBookEntry.create({
        data: {
          priceBookId: book.id, productId: p.id, isActive: true,
          useStandardPrice: false,
          listPrice: money(Number(p.standardCost) * 1.62 * pb.mult),
        },
      });
    }
  }

  const stages = ["PROSPECT", "QUALIFICATION", "DISCOVERY", "VALUE_PROPOSITION", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"];
  const themes = ["annual tool supply", "plant maintenance kit", "site rollout", "service spares"];
  const opportunities: any[] = [];
  for (let i = 0; i < 12; i++) {
    const account = accounts[i % accounts.length]!;
    const stage = stages[i % stages.length]!;
    const opp = await db.opportunity.create({
      data: {
        opportunityNumber: `OPP-2026-${String(1001 + i).padStart(5, "0")}`,
        name: `${account.name} — ${themes[i % themes.length]}`,
        description: `Supply of Ralli Wolf power tools and spares to ${account.name}.`,
        accountId: account.id, contactId: contacts[i % contacts.length]!.id,
        priceBookId: books[i % books.length]!.id,
        ownerId: pick(i).id, createdBy: admin.id,
        stage, type: i % 3 === 0 ? "NEW_CUSTOMER" : "EXISTING_CUSTOMER_UPGRADE",
        status: stage === "CLOSED_WON" ? "APPROVED" : stage === "CLOSED_LOST" ? "REJECTED" : i % 2 === 0 ? "IN_PROGRESS" : "QUOTE_CREATED",
        amount: money(240000 + i * 68000),
        probability: stage === "CLOSED_WON" ? 100 : stage === "CLOSED_LOST" ? 0 : 20 + i * 6,
        expectedCloseDate: days(20 - i * 3),
        actualCloseDate: stage.startsWith("CLOSED") ? ago(3) : null,
        leadSource: "MANUAL",
        nextStep: stage.startsWith("CLOSED") ? null : "Site visit and trial demonstration",
        lossReason: stage === "CLOSED_LOST" ? "Lost on price to an imported brand" : null,
        createdAt: ago(45 - i * 2),
      },
    });
    opportunities.push(opp);
    for (let j = 0; j < 3; j++) {
      const p = sellable[(i + j) % sellable.length]!;
      const q = 10 + j * 15;
      const list = Number(p.standardCost) * 1.62;
      const unit = list * (1 - (j * 3) / 100);
      await db.opportunityLineItem.create({
        data: {
          opportunityId: opp.id, productId: p.id, quantity: q,
          listPrice: money(list), unitPrice: money(unit),
          totalPrice: money(unit * q), discount: money(j * 3), sortOrder: j + 1,
        },
      });
    }
    await db.opportunityActivity.create({
      data: {
        opportunityId: opp.id, userId: pick(i).id, activityType: "STAGE_CHANGE",
        description: `Moved to ${stage.toLowerCase().replace(/_/g, " ")} after a site visit.`,
        newValue: stage, createdAt: ago(20 - i),
      },
    });
  }

  const quoteStatuses = ["DRAFT", "IN_REVIEW", "APPROVED", "PRESENTED", "ACCEPTED", "REJECTED"];
  const quotes: any[] = [];
  for (let i = 0; i < 10; i++) {
    const opp = opportunities[i % opportunities.length]!;
    const status = quoteStatuses[i % quoteStatuses.length]!;
    const q = await db.quote.create({
      data: {
        quoteNumber: `QT-2026-${String(2001 + i).padStart(5, "0")}`,
        name: `${opp.name} — quotation`,
        description: "Prices firm for 30 days. Freight extra at actuals.",
        opportunityId: opp.id, accountId: opp.accountId, contactId: opp.contactId,
        preparedById: pick(i).id, status, type: "QUOTE", version: 1, isPrimary: true,
        validUntil: days(30 - i),
        paymentTerms: "30 days from invoice", deliveryTerms: "Ex-works Bhiwandi",
        notes: "Includes one year warranty on motor and switch.",
        approvedAt: status === "APPROVED" ? ago(5) : null,
        rejectedAt: status === "REJECTED" ? ago(4) : null,
        presentedAt: status === "PRESENTED" || status === "ACCEPTED" ? ago(6) : null,
        acceptedAt: status === "ACCEPTED" ? ago(3) : null,
        createdAt: ago(30 - i * 2),
      },
    });
    quotes.push(q);
    let subtotal = 0;
    for (let j = 0; j < 3; j++) {
      const p = sellable[(i + j + 1) % sellable.length]!;
      const n = 8 + j * 12;
      const list = Number(p.standardCost) * 1.62;
      const unit = list * (1 - (2 + j * 2) / 100);
      subtotal += unit * n;
      await db.quoteLineItem.create({
        data: {
          quoteId: q.id, productId: p.id, quantity: n,
          listPrice: money(list), unitPrice: money(unit),
          totalPrice: money(unit * n), discount: money(2 + j * 2), sortOrder: j + 1,
        },
      });
    }
    await db.quote.update({
      where: { id: q.id },
      data: {
        subtotal: money(subtotal), taxPercent: money(18),
        taxAmount: money(subtotal * 0.18), shippingAmount: money(2500),
        grandTotal: money(subtotal * 1.18 + 2500),
      },
    });
  }

  const orderStatuses = ["APPROVED", "IN_FULFILLMENT", "SHIPPED", "DELIVERED", "DRAFT", "PENDING_APPROVAL"];
  for (let i = 0; i < 8; i++) {
    const q = quotes[i % quotes.length]!;
    const status = orderStatuses[i % orderStatuses.length]!;
    let subtotal = 0;
    const so = await db.salesOrder.create({
      data: {
        orderNumber: `SO-2026-${String(3001 + i).padStart(5, "0")}`,
        name: `${q.name.replace(" — quotation", "")} — order`,
        quoteId: q.id, accountId: q.accountId, contactId: q.contactId,
        ownerId: pick(i).id, status, orderDate: ago(24 - i * 2),
        expectedShipDate: days(4 + i), expectedDeliveryDate: days(8 + i),
        actualShipDate: ["SHIPPED", "DELIVERED"].includes(status) ? ago(3) : null,
        actualDeliveryDate: status === "DELIVERED" ? ago(1) : null,
        approvedAt: status === "DRAFT" || status === "PENDING_APPROVAL" ? null : ago(10),
        approvedById: status === "DRAFT" || status === "PENDING_APPROVAL" ? null : admin.id,
        paymentTerms: "30 days from invoice", deliveryTerms: "Ex-works Bhiwandi",
        shippingCity: "Mumbai", shippingState: "Maharashtra", shippingCountry: "India",
        createdAt: ago(24 - i * 2),
      },
    });
    for (let j = 0; j < 3; j++) {
      const p = sellable[(i + j + 2) % sellable.length]!;
      const n = 6 + j * 10;
      const list = Number(p.standardCost) * 1.62;
      const unit = list * 0.97;
      subtotal += unit * n;
      await db.salesOrderLineItem.create({
        data: {
          salesOrderId: so.id, productId: p.id, quantity: n,
          listPrice: money(list), unitPrice: money(unit),
          totalPrice: money(unit * n), discount: money(3), sortOrder: j + 1,
        },
      });
    }
    await db.salesOrder.update({
      where: { id: so.id },
      data: {
        subtotal: money(subtotal), taxPercent: money(18),
        taxAmount: money(subtotal * 0.18), shippingAmount: money(1800),
        grandTotal: money(subtotal * 1.18 + 1800),
      },
    });
  }

  // A live approval queue plus decided history.
  const states = ["PENDING", "PENDING", "APPROVED", "REJECTED", "PENDING", "APPROVED"];
  for (let i = 0; i < 6; i++) {
    const state = states[i]!;
    await db.approvalProcess.create({
      data: {
        targetObjectName: "QUOTE", targetRecordId: quotes[i % quotes.length]!.id,
        requestedToId: admin.id, createdById: pick(i + 1).id, status: state,
        comment: state === "REJECTED" ? "Discount exceeds the agreed band for this account." : null,
        lastActorId: state === "PENDING" ? null : admin.id,
        completedDate: state === "PENDING" ? null : ago(4 + i),
        createdAt: ago(10 - i),
      },
    });
  }
  console.log(`  3 price books, ${opportunities.length} opportunities, ${quotes.length} quotes, 8 orders`);

  await inventory({ ...ctx, sellable, quotes });
}

async function inventory(ctx: any) {
  const { db, admin, pick, products, warehouses, binIn } = ctx;
  console.log("inventory…");

  const all = Object.values(products) as any[];
  const lots: any[] = [];
  let mov = 1;
  let lotNo = 1;

  for (const p of all) {
    for (const whCode of ["MUM-PLANT", "MUM-FG"]) {
      const wh = warehouses[whCode];
      const bin = binIn(whCode, "STO");
      const n = p.itemType === "RAW_MATERIAL" ? 800 + ((lotNo * 37) % 900) : 120 + ((lotNo * 19) % 400);
      const lot = await db.stockLot.create({
        data: {
          lotNumber: `LOT-2026-${String(lotNo).padStart(5, "0")}`,
          productId: p.id, originWarehouseId: wh.id,
          batchNumber: p.trackingType === "BATCH" ? `B${2600 + lotNo}` : null,
          originalQuantity: qty(n), remainingQuantity: qty(n),
          unitCost: money(Number(p.standardCost)), sourceType: "PURCHASE",
          sourceReference: `GRN-2026-${String(700 + (lotNo % 5)).padStart(5, "0")}`,
          status: "ACTIVE", receivedAt: ago(40 - (lotNo % 30)),
          manufacturedDate: ago(60 - (lotNo % 30)),
          expiryDate: p.shelfLifeDays ? days(p.shelfLifeDays - 400 + (lotNo % 60)) : null,
        },
      });
      lots.push(lot);
      lotNo++;

      await db.stockBalance.create({
        data: {
          productId: p.id, warehouseId: wh.id, binId: bin.id, lotId: lot.id,
          quantity: qty(n), reservedQuantity: qty(n * 0.12),
          status: "AVAILABLE", lastMovementAt: ago(6),
        },
      });
      await db.stockMovement.create({
        data: {
          movementNumber: `MOV-2026-${String(mov++).padStart(7, "0")}`,
          movementType: "PURCHASE_RECEIPT", direction: "IN",
          productId: p.id, lotId: lot.id, uomId: p.uomId,
          toWarehouseId: wh.id, toBinId: bin.id,
          quantity: qty(n), unitCost: money(Number(p.standardCost)),
          totalCost: money(n * Number(p.standardCost)),
          referenceType: "GOODS_RECEIPT", referenceNumber: `GRN-2026-${String(700 + (mov % 5)).padStart(5, "0")}`,
          performedById: admin.id, notes: "Goods receipt posted to stock.",
          occurredAt: ago(40 - (mov % 30)),
        },
      });
    }
  }

  const types: [string, string][] = [
    ["SALES_ISSUE", "OUT"], ["PRODUCTION_CONSUMPTION", "OUT"], ["PRODUCTION_RECEIPT", "IN"],
    ["TRANSFER_OUT", "OUT"], ["TRANSFER_IN", "IN"], ["ADJUSTMENT_IN", "IN"],
    ["ADJUSTMENT_OUT", "OUT"], ["SCRAP", "OUT"], ["CYCLE_COUNT_GAIN", "IN"],
  ];
  for (let i = 0; i < 40; i++) {
    const lot = lots[i % lots.length]!;
    const [type, direction] = types[i % types.length]!;
    // Spread across a wide range: the opening receipts are large, so tiny
    // issues and transfers would render as flat lines beside them.
    const n = 60 + ((i * 47) % 380);
    await db.stockMovement.create({
      data: {
        movementNumber: `MOV-2026-${String(mov++).padStart(7, "0")}`,
        movementType: type, direction, productId: lot.productId, lotId: lot.id,
        ...(direction === "IN" ? { toWarehouseId: lot.originWarehouseId } : { fromWarehouseId: lot.originWarehouseId }),
        quantity: qty(n), unitCost: money(Number(lot.unitCost)),
        totalCost: money(n * Number(lot.unitCost)),
        reasonCode: type === "SCRAP" ? "DAMAGED_IN_HANDLING" : null,
        performedById: pick(i).id, occurredAt: ago(28 - (i % 28)),
      },
    });
  }

  const salesOrders = await db.salesOrder.findMany({ take: 4, orderBy: { id: "asc" } });
  for (let i = 0; i < 6; i++) {
    const lot = lots[(i * 3) % lots.length]!;
    await db.stockReservation.create({
      data: {
        productId: lot.productId, warehouseId: lot.originWarehouseId, lotId: lot.id,
        quantity: qty(12 + i * 4), releasedQuantity: qty(0), status: "ACTIVE",
        referenceType: i % 2 === 0 ? "SALES_ORDER" : "PRODUCTION_ORDER",
        referenceId: salesOrders[i % Math.max(salesOrders.length, 1)]?.id ?? 1,
        referenceNumber: salesOrders[i % Math.max(salesOrders.length, 1)]?.orderNumber ?? "SO-2026-03001",
        expiresAt: days(14), createdById: pick(i).id,
      },
    });
  }

  const alertTypes = ["REORDER_POINT", "BELOW_SAFETY_STOCK", "STOCKOUT", "EXPIRY_WARNING", "OVERSTOCK"];
  const severities = ["MEDIUM", "HIGH", "CRITICAL", "LOW", "MEDIUM"];
  for (let i = 0; i < all.length; i++) {
    const p = all[i]!;
    const wh = warehouses[i % 2 === 0 ? "MUM-PLANT" : "MUM-FG"];
    const safety = 80 + ((i * 13) % 120);
    await db.reorderRule.create({
      data: {
        productId: p.id, warehouseId: wh.id,
        safetyStock: qty(safety), reorderPoint: qty(safety * 1.5),
        reorderQuantity: qty(safety * 3), maximumStock: qty(safety * 6),
        leadTimeDays: 7 + (i % 10), autoRequisition: i % 3 === 0, isActive: true,
        lastEvaluatedAt: ago(1),
      },
    });
    if (i % 3 === 0) {
      const t = i % alertTypes.length;
      await db.stockAlert.create({
        data: {
          productId: p.id, warehouseId: wh.id,
          alertType: alertTypes[t], severity: severities[t],
          status: i % 6 === 0 ? "ACKNOWLEDGED" : "OPEN",
          currentQuantity: qty(safety * 0.6), thresholdQuantity: qty(safety * 1.5),
          shortfallQuantity: qty(safety * 0.9),
          message: `${p.name} is below its reorder point at ${wh.code}.`,
          acknowledgedById: i % 6 === 0 ? admin.id : null,
          acknowledgedAt: i % 6 === 0 ? ago(1) : null,
          createdAt: ago(9 - (i % 9)),
        },
      });
    }
  }

  // Four fast-moving components are deliberately run down below their safety
  // stock. Without this every item sits comfortably above its reorder point and
  // the shortage worklist, reorder alerts and availability checks all read
  // "nothing to do", which is the one thing a demo must not show.
  for (const code of ["CMP-ARM-800", "CMP-BRG-6001", "CMP-SW-10A", "RM-CU-WIRE"]) {
    const p = products[code];
    const rule = await db.reorderRule.findFirst({ where: { productId: p.id } });
    const short = rule ? Number(rule.safetyStock) * 0.35 : 20;
    await db.stockBalance.updateMany({
      where: { productId: p.id },
      data: { quantity: qty(short), reservedQuantity: qty(short * 0.4) },
    });
    await db.stockLot.updateMany({
      where: { productId: p.id },
      data: { remainingQuantity: qty(short) },
    });
  }

  const count = await db.stockCount.create({
    data: {
      countNumber: "CNT-2026-00014", warehouseId: warehouses["MUM-FG"].id,
      countType: "CYCLE", status: "IN_PROGRESS",
      scheduledDate: ago(2), startedAt: ago(1), countedById: pick(2).id,
      notes: "Quarterly cycle count — pick face and bulk storage.",
    },
  });
  for (let i = 0; i < 10; i++) {
    const lot = lots[i]!;
    const system = 60 + i * 9;
    const counted = i % 4 === 0 ? system - 3 : i % 5 === 0 ? system + 2 : system;
    await db.stockCountLine.create({
      data: {
        stockCountId: count.id, productId: lot.productId,
        binId: binIn("MUM-FG", "STO").id, lotId: lot.id,
        systemQuantity: qty(system),
        countedQuantity: i < 7 ? qty(counted) : null,
        // Both are non-nullable with a default of 0 — an uncounted line has no
        // variance yet, it does not have an unknown one.
        varianceQuantity: i < 7 ? qty(counted - system) : qty(0),
        varianceValue: i < 7 ? money((counted - system) * Number(lot.unitCost)) : money(0),
        reasonCode: i % 4 === 0 ? "PICKING_ERROR" : null,
        isPosted: false,
      },
    });
  }

  for (let i = 0; i < 5; i++) {
    const lot = lots[i + 2]!;
    const status = i < 2 ? "COMPLETED" : i < 4 ? "IN_PROGRESS" : "PENDING";
    await db.putawayTask.create({
      data: {
        taskNumber: `PUT-2026-${String(101 + i).padStart(6, "0")}`,
        warehouseId: lot.originWarehouseId, productId: lot.productId, lotId: lot.id,
        fromBinId: binIn("MUM-PLANT", "RCV").id,
        toBinId: i < 4 ? binIn("MUM-PLANT", "STO").id : null,
        quantity: qty(24 + i * 8),
        movedQuantity: status === "COMPLETED" ? qty(24 + i * 8) : qty(0),
        status, priority: i, assignedToId: pick(i).id,
        completedById: status === "COMPLETED" ? pick(i).id : null,
        completedAt: status === "COMPLETED" ? ago(2) : null,
        createdAt: ago(5 - i),
      },
    });
  }

  for (let i = 0; i < 4; i++) {
    const status = ["RELEASED", "IN_PROGRESS", "PICKED", "PACKED"][i]!;
    const pl = await db.pickList.create({
      data: {
        pickListNumber: `PCK-2026-${String(201 + i).padStart(6, "0")}`,
        warehouseId: warehouses["MUM-FG"].id, status, strategy: "FIFO",
        referenceType: "SALES_ORDER",
        referenceId: salesOrders[i % Math.max(salesOrders.length, 1)]?.id ?? 1,
        referenceNumber: salesOrders[i % Math.max(salesOrders.length, 1)]?.orderNumber ?? "SO-2026-03001",
        assignedToId: pick(i).id, releasedById: admin.id, releasedAt: ago(4 - i),
        completedAt: i >= 2 ? ago(1) : null,
        createdAt: ago(5 - i),
      },
    });
    const tasks: any[] = [];
    for (let j = 0; j < 3; j++) {
      const lot = lots[(i * 3 + j) % lots.length]!;
      const want = 10 + j * 6;
      const done = i >= 2 || j === 0;
      tasks.push(
        await db.pickTask.create({
          data: {
            pickListId: pl.id, productId: lot.productId, lotId: lot.id,
            binId: binIn("MUM-FG", "PIC").id, sequence: j + 1,
            requestedQuantity: qty(want),
            pickedQuantity: done ? qty(want) : qty(0),
            shortQuantity: qty(0),
            status: done ? "COMPLETED" : "PENDING",
            pickedById: done ? pick(j).id : null,
            pickedAt: done ? ago(1) : null,
          },
        })
      );
    }
    if (i === 3) {
      const pkg = await db.package.create({
        data: {
          packageNumber: `PKG-2026-${String(301 + i).padStart(6, "0")}`,
          pickListId: pl.id, status: "PACKED", grossWeightKg: qty(18.4),
          lengthCm: qty(60), widthCm: qty(40), heightCm: qty(35),
          trackingNumber: "BLR9284471IN", carrier: "Blue Dart",
          packedById: admin.id, packedAt: ago(1),
        },
      });
      for (const t of tasks) {
        await db.packageLine.create({
          data: {
            packageId: pkg.id, pickTaskId: t.id, productId: t.productId,
            lotId: t.lotId, quantity: t.requestedQuantity.toString(),
          },
        });
      }
    }
  }
  console.log(`  ${lots.length} lots, ${mov - 1} movements, alerts, counts and tasks`);

  await production({ ...ctx, lots });
}

async function production(ctx: any) {
  const { db, admin, pick, products, warehouses, lots } = ctx;
  console.log("bills of materials and production…");

  const buildable: { fg: string; parts: [string, number][] }[] = [
    { fg: "RW-AG4-800", parts: [["CMP-ARM-800", 1], ["CMP-STA-800", 1], ["CMP-HSG-AG4", 1], ["CMP-SW-10A", 1], ["CMP-CBL-2M", 1], ["CMP-BRG-6001", 2], ["CMP-CRB-01", 1], ["CMP-GRD-100", 1], ["PKG-BOX-AG4", 1]] },
    { fg: "RW-AG5-1200", parts: [["CMP-ARM-800", 1], ["CMP-STA-800", 1], ["CMP-GEA-M8", 1], ["CMP-SW-10A", 1], ["CMP-BRG-6001", 2], ["PKG-BOX-AG4", 1]] },
    { fg: "RW-HD26-800", parts: [["CMP-ARM-800", 1], ["CMP-GEA-M8", 1], ["CMP-BRG-6001", 3], ["CMP-SW-10A", 1], ["PKG-BOX-HD26", 1]] },
    { fg: "RW-DR13-650", parts: [["CMP-ARM-800", 1], ["CMP-STA-800", 1], ["CMP-CRB-01", 1], ["CMP-CBL-2M", 1], ["PKG-BOX-AG4", 1]] },
  ];
  const boms: any[] = [];
  for (let i = 0; i < buildable.length; i++) {
    const spec = buildable[i]!;
    const fg = products[spec.fg];
    const draft = i === 3;
    const bom = await db.billOfMaterials.create({
      data: {
        bomNumber: `BOM-${String(101 + i).padStart(5, "0")}`,
        productId: fg.id, name: `${fg.name} — production structure`,
        version: 1, revision: draft ? "B" : "A",
        status: draft ? "DRAFT" : "ACTIVE", isDefault: !draft,
        outputQuantity: qty(1), uomId: fg.uomId,
        laborCost: money(180 + i * 40), overheadCost: money(120 + i * 25),
        rolledUpCost: money(Number(fg.standardCost) * 0.72),
        costedAt: ago(20), effectiveFrom: ago(90),
        notes: "Frozen structure. Raise a revision to change it.",
        createdById: admin.id,
        approvedById: draft ? null : admin.id,
        approvedAt: draft ? null : ago(85),
      },
    });
    boms.push(bom);
    for (let j = 0; j < spec.parts.length; j++) {
      const [code, n] = spec.parts[j]!;
      const comp = await db.bomComponent.create({
        data: {
          bomId: bom.id, componentProductId: products[code].id, lineNumber: j + 1,
          quantity: qty(n), uomId: products[code].uomId,
          scrapPercent: money(j % 3), operationSequence: (j + 1) * 10,
          referenceDesignator: `POS-${j + 1}`,
          notes: j === 0 ? "Critical to function — inspect on receipt." : null,
        },
      });
      if (code === "CMP-BRG-6001") {
        await db.bomComponentSubstitute.create({
          data: {
            bomComponentId: comp.id, substituteProductId: products["CMP-GEA-M8"].id,
            priority: 1, conversionFactor: qty(1), isActive: true,
            notes: "Approved alternate for the 6001 ZZ bearing.",
          },
        });
      }
    }
    await db.bomChangeLog.create({
      data: {
        bomId: bom.id, changeType: "STATUS_CHANGED", fieldName: "status",
        oldValue: "DRAFT", newValue: draft ? "DRAFT" : "ACTIVE",
        description: draft ? "Created as a draft revision." : "Activated after engineering sign-off.",
        reason: "Engineering change request",
        changedById: admin.id, createdAt: ago(85 - i),
      },
    });
  }

  // A plant this size carries a dozen live build orders, not four. The board
  // and the capacity chart only say anything useful against a real order book.
  const poStatuses = [
    "RELEASED", "IN_PROGRESS", "COMPLETED", "PLANNED", "IN_PROGRESS",
    "PLANNED", "RELEASED", "PLANNED", "COMPLETED", "RELEASED",
    "PLANNED", "PLANNED",
  ];
  for (let i = 0; i < poStatuses.length; i++) {
    const bom = boms[i % 3]!;
    const planned = 100 + i * 40;
    const status = poStatuses[i]!;
    const done = status === "COMPLETED";
    const running = status === "IN_PROGRESS";
    const order = await db.productionOrder.create({
      data: {
        orderNumber: `PRO-2026-${String(401 + i).padStart(5, "0")}`,
        productId: bom.productId, bomId: bom.id,
        warehouseId: warehouses["MUM-PLANT"].id,
        plannedQuantity: qty(planned),
        producedQuantity: done ? qty(planned) : running ? qty(planned * 0.55) : qty(0),
        scrappedQuantity: done ? qty(3) : qty(0),
        status,
        plannedStartDate: ago(Math.max(12 - i, 1)), plannedEndDate: days(4 + i),
        actualStartDate: status === "PLANNED" ? null : ago(Math.max(10 - i, 1)),
        actualEndDate: done ? ago(2) : null,
        plannedMaterialCost: money(planned * 1200),
        actualMaterialCost: done ? money(planned * 1240) : running ? money(planned * 700) : money(0),
        notes: "Build order against the frozen structure.",
        createdById: admin.id,
      },
    });
    const comps = await db.bomComponent.findMany({ where: { bomId: bom.id } });
    for (const c of comps) {
      const required = Number(c.quantity) * planned;
      await db.productionOrderComponent.create({
        data: {
          productionOrderId: order.id, productId: c.componentProductId,
          requiredQuantity: qty(required),
          issuedQuantity: done ? qty(required) : running ? qty(required * 0.6) : qty(0),
          consumedQuantity: done ? qty(required) : running ? qty(required * 0.55) : qty(0),
          wastedQuantity: done ? qty(required * 0.01) : qty(0),
          scrapPercent: c.scrapPercent?.toString() ?? "0",
          standardUnitCost: money(200),
        },
      });
    }
    if (status !== "PLANNED") {
      for (let k = 0; k < 3; k++) {
        const lot = lots[(i + k) % lots.length]!;
        const n = 20 + k * 10;
        await db.productionOrderConsumption.create({
          data: {
            productionOrderId: order.id, lotId: lot.id, quantity: qty(n),
            consumptionType: k === 2 ? "SCRAP" : "ISSUE",
            unitCost: money(Number(lot.unitCost)),
            totalCost: money(n * Number(lot.unitCost)),
            reasonCode: k === 2 ? "SETUP_LOSS" : null,
            occurredAt: ago(6 - k),
          },
        });
      }
    }
  }
  console.log(`  ${boms.length} bills of materials, ${poStatuses.length} production orders`);

  await purchasing(ctx);
}

async function purchasing(ctx: any) {
  const { db, admin, pick, products, warehouses, suppliers } = ctx;
  console.log("purchasing…");

  const supplierList = Object.values(suppliers) as any[];
  const prStates = ["PENDING_APPROVAL", "APPROVED", "CONVERTED", "DRAFT", "PARTIALLY_CONVERTED", "PENDING_APPROVAL"];
  for (let i = 0; i < 6; i++) {
    const state = prStates[i]!;
    const pr = await db.purchaseRequisition.create({
      data: {
        requisitionNumber: `PR-2026-${String(501 + i).padStart(5, "0")}`,
        warehouseId: warehouses[i % 2 === 0 ? "MUM-PLANT" : "MUM-FG"].id,
        requestedById: pick(i).id, status: state,
        origin: i % 3 === 0 ? "AUTO_REORDER" : "MANUAL",
        requiredByDate: days(10 + i),
        suggestedSupplierId: supplierList[i % supplierList.length]!.id,
        estimatedValue: money(120000 + i * 30000),
        justification: "Replenishment against the reorder point.",
        approvedById: ["APPROVED", "CONVERTED", "PARTIALLY_CONVERTED"].includes(state) ? admin.id : null,
        approvedAt: ["APPROVED", "CONVERTED", "PARTIALLY_CONVERTED"].includes(state) ? ago(4) : null,
        createdAt: ago(14 - i),
      },
    });
    const codes = ["CMP-ARM-800", "CMP-BRG-6001", "RM-CU-WIRE", "PKG-BOX-AG4"];
    for (let j = 0; j < 3; j++) {
      const p = products[codes[(i + j) % codes.length]!];
      const n = 200 + j * 150;
      await db.purchaseRequisitionLine.create({
        data: {
          requisitionId: pr.id, productId: p.id, quantity: qty(n),
          orderedQuantity: state === "CONVERTED" ? qty(n) : state === "PARTIALLY_CONVERTED" ? qty(n * 0.5) : qty(0),
          estimatedUnitPrice: money(Number(p.standardCost)),
          uomId: p.uomId, requiredByDate: days(10 + i),
          notes: j === 0 ? "Preferred vendor pricing applies." : null,
        },
      });
    }
  }

  const poStates = ["SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED", "RECEIVED", "PENDING_APPROVAL", "APPROVED", "DRAFT", "SENT", "ACKNOWLEDGED"];
  const orders: any[] = [];
  for (let i = 0; i < 9; i++) {
    const sup = supplierList[i % supplierList.length]!;
    const wh = warehouses[i % 2 === 0 ? "MUM-PLANT" : "MUM-FG"];
    const status = poStates[i]!;
    const approved = ["APPROVED", "SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED", "RECEIVED"].includes(status);
    const po = await db.purchaseOrder.create({
      data: {
        poNumber: `PO-2026-${String(601 + i).padStart(5, "0")}`,
        supplierId: sup.id, warehouseId: wh.id, createdById: admin.id, status,
        orderDate: ago(26 - i * 2),
        expectedDeliveryDate: days(i < 4 ? 3 + i : -2),
        promisedDate: days(i < 4 ? 4 + i : -1),
        currencyCode: "INR", exchangeRate: "1.000000",
        paymentTerms: sup.paymentTerms, incoterms: "FOB",
        shipToAddress: `${wh.name}, ${wh.city}`,
        notes: "Deliver against the agreed schedule. Test certificates required.",
        approvedById: approved ? admin.id : null,
        approvedAt: approved ? ago(20 - i) : null,
        sentAt: ["SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED", "RECEIVED"].includes(status) ? ago(18 - i) : null,
        acknowledgedAt: ["ACKNOWLEDGED", "PARTIALLY_RECEIVED", "RECEIVED"].includes(status) ? ago(16 - i) : null,
        closedAt: status === "RECEIVED" ? ago(2) : null,
        createdAt: ago(26 - i * 2),
      },
    });
    orders.push(po);

    const supProducts = await db.supplierProduct.findMany({ where: { supplierId: sup.id } });
    let subtotal = 0;
    for (let j = 0; j < supProducts.length; j++) {
      const sp = supProducts[j]!;
      const n = 250 + j * 120;
      const price = Number(sp.unitPrice);
      const line = n * price;
      subtotal += line;
      const received = status === "RECEIVED" ? n : status === "PARTIALLY_RECEIVED" ? n * 0.6 : 0;
      await db.purchaseOrderLine.create({
        data: {
          purchaseOrderId: po.id, productId: sp.productId, lineNumber: j + 1,
          description: `Supply as per drawing rev ${String.fromCharCode(65 + j)}`,
          quantity: qty(n), uomId: null, unitPrice: money(price),
          discountPercent: money(0), taxPercent: money(18), taxAmount: money(line * 0.18),
          lineTotal: money(line),
          receivedQuantity: qty(received),
          acceptedQuantity: qty(received * 0.97),
          rejectedQuantity: qty(received * 0.03),
          expectedDate: days(i < 4 ? 3 + i : -2),
          status: status === "RECEIVED" ? "RECEIVED" : status === "PARTIALLY_RECEIVED" ? "PARTIALLY_RECEIVED" : "OPEN",
        },
      });
    }
    await db.purchaseOrder.update({
      where: { id: po.id },
      data: {
        subtotal: money(subtotal), discountAmount: money(0),
        taxAmount: money(subtotal * 0.18), shippingAmount: money(3200),
        grandTotal: money(subtotal * 1.18 + 3200),
      },
    });
  }

  const grnStates = ["COMPLETED", "PENDING_QC", "QC_IN_PROGRESS", "COMPLETED", "PENDING_QC"];
  for (let i = 0; i < 5; i++) {
    const po = orders[i]!;
    const poLines = await db.purchaseOrderLine.findMany({ where: { purchaseOrderId: po.id } });
    if (!poLines.length) continue;
    const status = grnStates[i]!;
    let totalRecv = 0, totalAcc = 0, totalRej = 0, totalVal = 0;
    const grn = await db.goodsReceiptNote.create({
      data: {
        grnNumber: `GRN-2026-${String(701 + i).padStart(5, "0")}`,
        purchaseOrderId: po.id, supplierId: po.supplierId, warehouseId: po.warehouseId,
        receivedById: pick(i).id, status, receivedDate: ago(9 - i),
        supplierInvoiceNumber: `INV-${8800 + i}`, supplierInvoiceDate: ago(10 - i),
        vehicleNumber: `MH-04-AB-${String(2000 + i * 37).slice(0, 4)}`,
        lrNumber: `LR-${5500 + i}`,
        isOnTime: i % 3 !== 1, delayDays: i % 3 === 1 ? 2 : 0,
        notes: "Material received in good condition unless noted on the lines.",
        postedAt: status === "COMPLETED" ? ago(8 - i) : null,
        createdAt: ago(9 - i),
      },
    });
    for (let j = 0; j < poLines.length; j++) {
      const line = poLines[j]!;
      const received = Number(line.quantity) * (j === 1 ? 0.9 : 1);
      const rejected = j === 0 ? received * 0.04 : 0;
      const accepted = received - rejected;
      totalRecv += received; totalAcc += accepted; totalRej += rejected;
      totalVal += received * Number(line.unitPrice);
      const grnLine = await db.goodsReceiptLine.create({
        data: {
          grnId: grn.id, purchaseOrderLineId: line.id, productId: line.productId,
          lineNumber: j + 1, receivedQuantity: qty(received),
          acceptedQuantity: qty(accepted), rejectedQuantity: qty(rejected),
          unitCost: money(Number(line.unitPrice)),
          batchNumber: `B${3300 + i * 10 + j}`,
          manufacturedDate: ago(30), qcResult: j === 0 ? (i === 1 ? "FAIL" : "PASS") : "PENDING",
          rejectionReason: rejected ? "Winding resistance outside the specified band" : null,
          isPosted: status === "COMPLETED",
        },
      });
      if (j === 0) {
        const qc = await db.qualityCheck.create({
          data: {
            qcNumber: `QC-2026-${String(801 + i).padStart(5, "0")}`,
            grnId: grn.id, grnLineId: grnLine.id, sampleSize: qty(20),
            inspectedQuantity: qty(received), acceptedQuantity: qty(accepted),
            rejectedQuantity: qty(rejected),
            result: i === 1 ? "FAIL" : i === 2 ? "CONDITIONAL_PASS" : "PASS",
            defectType: i === 1 ? "ELECTRICAL" : null,
            inspectedById: pick(i + 1).id, inspectedAt: ago(8 - i),
            remarks: i === 1 ? "Winding resistance outside the specified band." : "Sampled per plan. Conforms.",
          },
        });
        for (const [name, spec, observed, pass] of [
          ["Visual inspection", "No physical damage", "Conforms", true],
          ["Dimensional check", "±0.05 mm", "+0.02 mm", true],
          ["Winding resistance", "2.4 – 2.8 Ω", i === 1 ? "3.1 Ω" : "2.6 Ω", i !== 1],
        ] as [string, string, string, boolean][]) {
          await db.qualityCheckParameter.create({
            data: {
              qualityCheckId: qc.id, parameterName: name, specification: spec,
              minValue: name === "Winding resistance" ? money(2.4) : null,
              maxValue: name === "Winding resistance" ? money(2.8) : null,
              observedValue: observed, isPassed: pass,
            },
          });
        }
      }
    }
    await db.goodsReceiptNote.update({
      where: { id: grn.id },
      data: {
        totalReceivedQuantity: qty(totalRecv), totalAcceptedQuantity: qty(totalAcc),
        totalRejectedQuantity: qty(totalRej), totalValue: money(totalVal),
      },
    });
  }

  const mrStates = ["SUBMITTED", "PARTIALLY_ISSUED", "ISSUED", "DRAFT", "SUBMITTED"];
  const prodOrders = await db.productionOrder.findMany({ take: 5, orderBy: { id: "asc" } });
  for (let i = 0; i < 5; i++) {
    const state = mrStates[i]!;
    const mr = await db.materialRequisition.create({
      data: {
        requisitionNumber: `MR-2026-${String(901 + i).padStart(5, "0")}`,
        warehouseId: warehouses["MUM-PLANT"].id,
        productionOrderId: prodOrders[i % Math.max(prodOrders.length, 1)]?.id ?? null,
        requestedById: pick(i).id, status: state, requiredByDate: days(3 + i),
        purpose: "Issue to the assembly line against the current build order.",
        notes: "Collect from the plant stores counter.",
        issuedById: state === "ISSUED" || state === "PARTIALLY_ISSUED" ? admin.id : null,
        issuedAt: state === "ISSUED" || state === "PARTIALLY_ISSUED" ? ago(2) : null,
        createdAt: ago(7 - i),
      },
    });
    const codes = ["CMP-ARM-800", "CMP-STA-800", "CMP-BRG-6001", "CMP-CRB-01"];
    for (let j = 0; j < 3; j++) {
      const p = products[codes[(i + j) % codes.length]!];
      const req = 60 + j * 25;
      await db.materialRequisitionLine.create({
        data: {
          requisitionId: mr.id, productId: p.id, requestedQuantity: qty(req),
          issuedQuantity: state === "ISSUED" ? qty(req) : state === "PARTIALLY_ISSUED" ? qty(req * 0.5) : qty(0),
          uomId: p.uomId, notes: null,
        },
      });
    }
  }
  // Four items are left genuinely short. `shortages` counts open purchase-order
  // quantities as incoming cover, so a shortage only exists when safety stock
  // exceeds on-hand *plus* what is already on order. Anything less and the
  // worklist correctly reports "nothing to do", which is no use in a demo.
  for (const code of ["CMP-ARM-800", "CMP-BRG-6001", "CMP-SW-10A", "RM-CU-WIRE"]) {
    const p = products[code];
    const rules = await db.reorderRule.findMany({ where: { productId: p.id } });
    for (const rule of rules) {
      const balances = await db.stockBalance.findMany({
        where: { productId: p.id, warehouseId: rule.warehouseId },
        select: { quantity: true },
      });
      const onHand = balances.reduce((a: number, b: any) => a + Number(b.quantity), 0);
      const openLines = await db.purchaseOrderLine.findMany({
        where: {
          productId: p.id,
          status: { in: ["OPEN", "PARTIALLY_RECEIVED"] },
          purchaseOrder: { warehouseId: rule.warehouseId, status: { notIn: ["CANCELLED", "DRAFT", "CLOSED"] } },
        },
        select: { quantity: true, receivedQuantity: true },
      });
      const incoming = openLines.reduce(
        (a: number, l: any) => a + Math.max(Number(l.quantity) - Number(l.receivedQuantity), 0), 0);
      const safety = Math.ceil((onHand + incoming) * 1.35) + 50;
      await db.reorderRule.update({
        where: { id: rule.id },
        data: {
          safetyStock: qty(safety),
          reorderPoint: qty(safety * 1.4),
          reorderQuantity: qty(safety * 2),
          maximumStock: qty(safety * 4),
        },
      });
    }
  }

  console.log("  6 requisitions, 9 purchase orders, 5 receipts, 5 material requisitions, 4 shaped shortages");

  await marketing(ctx);
  await planning(ctx);
  await finance(ctx);
  await sequences(ctx);
}

async function marketing(ctx: any) {
  const { db, admin, pick } = ctx;
  console.log("marketing and notifications…");

  const contacts = await db.contact.findMany({ orderBy: { id: "asc" } });
  const leads = await db.lead.findMany({ orderBy: { id: "asc" } });

  for (const [name, description] of [
    ["Maintenance buyers — West", "Contacts at plants across Maharashtra and Gujarat"],
    ["Distributor network", "Channel partners carrying the Ralli Wolf range"],
    ["Lapsed accounts", "No order placed in the last two quarters"],
  ] as [string, string][]) {
    const seg = await db.segment.create({
      data: {
        name, description, entityType: "CONTACT", logicOperator: "AND",
        createdBy: admin.id,
      },
    });
    await db.segmentRule.create({
      data: { segmentId: seg.id, ruleType: "STATE", operator: "equals", value: "Maharashtra" },
    });
  }

  const campaigns: [string, string, number, string][] = [
    ["Monsoon Service Drive 2026", "EMAIL", 20, "Service reminder to maintenance buyers"],
    ["New AG5 Launch Announcement", "WHATSAPP", 12, "Launch of the 125 mm 1200 W angle grinder"],
    ["Distributor Scheme — Q3", "EMAIL", 6, "Volume scheme for channel partners"],
    ["Safety Guard Advisory", "WHATSAPP", 2, "Advisory to registered owners"],
  ];
  for (let i = 0; i < campaigns.length; i++) {
    const [name, channel, startAgo, description] = campaigns[i]!;
    const c = await db.campaign.create({
      data: { name, description, startDate: ago(startAgo), endDate: days(14 - i * 3), createdBy: admin.id },
    });
    await db.campaignChannel.create({
      data: {
        campaignId: c.id, channelType: channel,
        externalId: channel === "EMAIL" ? "marketing@ralliwolf.in" : "919820098200",
      },
    });
    for (let j = 0; j < Math.min(contacts.length, 8); j++) {
      const contact = contacts[(i + j) % contacts.length]!;
      const member = await db.campaignMember.create({
        data: {
          campaignId: c.id, contactId: contact.id,
          status: ["SENT", "OPENED", "CLICKED", "DELIVERED"][j % 4]!,
        },
      });
      await db.campaignDelivery.create({
        data: {
          campaignId: c.id, campaignMemberId: member.id, contactId: contact.id,
          // address is non-nullable, so fall back to the email when no phone is held.
          channel, address: (channel === "EMAIL" ? contact.email : contact.phone) ?? contact.email,
          status: j % 5 === 0 ? "FAILED" : "DELIVERED",
          sentAt: ago(10 - (j % 8)),
          deliveredAt: j % 5 === 0 ? null : ago(10 - (j % 8)),
          readAt: j % 3 === 0 ? ago(9 - (j % 8)) : null,
          failedAt: j % 5 === 0 ? ago(10 - (j % 8)) : null,
          errorCode: j % 5 === 0 ? "RECIPIENT_UNAVAILABLE" : null,
          errorMessage: j % 5 === 0 ? "Recipient number is not registered on WhatsApp" : null,
        },
      });
    }
  }

  // WhatsApp sender numbers and approved templates, so the management screen
  // has an account to select and templates to list.
  const waNumbers: any[] = [];
  for (const [display, phone, sender] of [
    ["Ralli Wolf Support", "919820098200", "RWSUPP"],
    ["Ralli Wolf Sales", "919820098201", "RWSALE"],
  ] as [string, string, string][]) {
    const enc = encryptSecret(`msg91-${sender.toLowerCase()}-placeholder-key`);
    waNumbers.push(
      await db.whatsAppNumber.create({
        data: {
          displayName: display, phoneNumber: phone, provider: "MSG91",
          businessId: `BIZ-${sender}`, senderId: sender,
          encryptedApiKey: enc.cipherText, iv: enc.iv, authTag: enc.authTag,
          maskedTail: "…8200", status: "ACTIVE", createdBy: admin.id,
        },
      })
    );
  }
  const templates: [string, string, string][] = [
    ["order_dispatch_update", "MARKETING", "APPROVED"],
    ["service_camp_invite", "MARKETING", "APPROVED"],
    ["warranty_reminder", "UTILITY", "APPROVED"],
    ["dealer_price_list", "MARKETING", "PENDING"],
    ["quote_follow_up", "UTILITY", "APPROVED"],
  ];
  for (let i = 0; i < templates.length; i++) {
    const [name, category, status] = templates[i]!;
    await db.whatsAppTemplate.create({
      data: {
        whatsappNumberId: waNumbers[i % waNumbers.length]!.id,
        providerTemplateId: `TPL-${9100 + i}`,
        name, language: "en", status, category,
        components: [
          { type: "BODY", text: "Hello {{1}}, this is Ralli Wolf regarding {{2}}. Reply STOP to opt out." },
          { type: "FOOTER", text: "Ralli Wolf — power tools since 1963" },
        ],
      },
    });
  }

  const lps: [string, string][] = [
    ["Angle Grinder Range 2026", "ACTIVE"],
    ["Dealer Enquiry — West Zone", "ACTIVE"],
    ["Service Camp Registration", "CLOSED"],
  ];
  for (let i = 0; i < lps.length; i++) {
    const [name, status] = lps[i]!;
    const lp = await db.landingPageCampaign.create({
      data: {
        name, status, uniqueId: `rw-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 28)}`,
        description: `Landing page capturing enquiries for ${name.toLowerCase()}.`,
      },
    });
    for (let j = 0; j < 4; j++) {
      const lead = leads[(i * 4 + j) % leads.length]!;
      await db.enquiry.create({
        data: {
          leadId: lead.id, landingPageCampaignId: lp.id,
          status: ["UNRESOLVED", "IN_PROGRESS", "RESOLVED"][j % 3]!,
          enquiryCreatedAt: ago(18 - j),
          resolvedAt: j % 3 === 2 ? ago(4) : null,
          resolvedBy: j % 3 === 2 ? admin.id : null,
        },
      });
    }
  }

  for (let i = 0; i < 4; i++) {
    const contact = contacts[(i * 3) % contacts.length]!;
    await db.optOut.create({
      data: {
        phone: contact.phone ?? `9${String(770000000 + i).slice(0, 9)}`,
        channel: "WHATSAPP", source: "KEYWORD",
        reason: "Replied STOP to a campaign message", optedOutAt: ago(12 - i),
      },
    });
  }

  for (const name of ["price", "dealer", "service", "warranty", "spares"]) {
    const k = await db.keyword.create({ data: { name } });
    for (let j = 0; j < 3; j++) {
      const lead = leads[(name.length + j) % leads.length]!;
      await db.leadKeyword.create({ data: { leadId: lead.id, keywordId: k.id } }).catch(() => {});
    }
  }

  const notices: [string, string, string, string][] = [
    ["APPROVAL_REQUESTED", "Approval Requested — Quote QT-2026-02003", "Nisha Dudi submitted a quotation for your approval.", "/sales/approvals"],
    ["STOCK_ALERT", "Inventory alerts", "4 critical stock alert(s) need attention", "/inventory/alerts"],
    ["QC_FAILED", "Quality check failed — GRN-2026-00702", "Armature Assembly 800 W from Bharat Electricals & Windings: 10 rejected of 250 inspected.", "/purchasing/goods-receipts"],
    ["PURCHASE_ORDER_APPROVED", "Purchase Order PO-2026-00603 approved", "The order can now be sent to the supplier.", "/purchasing/orders"],
  ];
  for (const u of [admin, pick(1), pick(2)]) {
    for (let i = 0; i < notices.length; i++) {
      const [type, title, message, link] = notices[i]!;
      await db.notification.create({
        data: { userId: u.id, type, title, message, link, isRead: i > 2, createdAt: ago(i + 1) },
      });
    }
  }

  await db.globalSetting.upsert({
    where: { key: "demo.workspace.notice" },
    update: { value: "Ralli Wolf presentation dataset" },
    create: {
      key: "demo.workspace.notice", value: "Ralli Wolf presentation dataset",
      description: "Identifies the presentation dataset",
    },
  });
}


async function planning(ctx) {
  const { db, warehouses } = ctx;
  console.log("production planning…");

  const plant = warehouses["MUM-PLANT"];
  const centreSpecs = [
    { code: "WC-CNC",  name: "CNC Machining Cell",    type: "MACHINE",       cap: 480, eff: 82, cost: 1450, par: 2 },
    { code: "WC-WIND", name: "Armature Winding Line", type: "ASSEMBLY_LINE", cap: 480, eff: 88, cost: 980,  par: 3 },
    { code: "WC-ASSY", name: "Final Assembly Line",   type: "ASSEMBLY_LINE", cap: 480, eff: 90, cost: 760,  par: 4 },
    { code: "WC-TEST", name: "Electrical Test Bench", type: "INSPECTION",    cap: 420, eff: 95, cost: 540,  par: 2 },
    { code: "WC-PACK", name: "Packing Station",       type: "PACKING",       cap: 480, eff: 92, cost: 380,  par: 2 },
  ];
  const centres = {};
  for (const c of centreSpecs) {
    centres[c.code] = await db.workCenter.create({
      data: {
        code: c.code, name: c.name, warehouseId: plant.id, type: c.type,
        description: `${c.name} at ${plant.code}`,
        capacityMinutesPerDay: c.cap, efficiencyPercent: c.eff.toFixed(2),
        costPerHour: c.cost.toFixed(2), parallelCapacity: c.par, isActive: true,
      },
    });
  }

  // Routing is written directly rather than through the API, because the API
  // correctly refuses to change an active BOM. In reality the routing is
  // authored before the BOM is activated, which is the state this recreates.
  const ROUTING = [
    ["WC-CNC",  "Machine housing and spindle", 30, 1.6],
    ["WC-WIND", "Wind and varnish armature",   25, 2.4],
    ["WC-ASSY", "Assemble and align",          15, 3.1],
    ["WC-TEST", "Electrical safety test",      10, 0.9],
    ["WC-PACK", "Pack and label",               5, 0.6],
  ];
  const boms = await db.billOfMaterials.findMany({ orderBy: { id: "asc" } });
  for (const bom of boms) {
    for (let i = 0; i < ROUTING.length; i++) {
      const [wc, name, setup, run] = ROUTING[i];
      await db.bomOperation.create({
        data: {
          bomId: bom.id, workCenterId: centres[wc].id,
          sequence: (i + 1) * 10, name,
          setupMinutes: setup, runMinutesPerUnit: run.toFixed(4),
          isBlocking: true,
        },
      });
    }
  }

  // Lay each unfinished order's operations back to back from its planned
  // start — the same arithmetic the scheduling endpoint uses.
  const orders = await db.productionOrder.findMany({
    where: { status: { in: ["DRAFT", "PLANNED", "RELEASED", "IN_PROGRESS"] } },
    orderBy: { id: "asc" },
  });
  let scheduled = 0;
  for (const order of orders) {
    const routing = await db.bomOperation.findMany({
      where: { bomId: order.bomId }, orderBy: { sequence: "asc" },
    });
    if (!routing.length) continue;
    const qty = Number(order.plannedQuantity);
    // Work already under way keeps its real start; anything still to be built
    // is laid out from today onward, staggered a day apart. A capacity board
    // that only shows the past answers no useful question.
    let cursor =
      order.status === "IN_PROGRESS" && order.plannedStartDate
        ? new Date(order.plannedStartDate)
        : days(scheduled);
    cursor.setHours(8, 0, 0, 0);
    const firstStart = new Date(cursor);
    let lastEnd = new Date(cursor);
    for (const op of routing) {
      const minutes = Math.ceil(op.setupMinutes + Number(op.runMinutesPerUnit) * qty);
      const start = new Date(cursor);
      const end = new Date(start.getTime() + minutes * 60000);
      lastEnd = end;
      const status =
        order.status === "IN_PROGRESS" && op.sequence <= 20
          ? "COMPLETED"
          : order.status === "IN_PROGRESS" && op.sequence === 30
            ? "IN_PROGRESS"
            : "SCHEDULED";
      await db.productionOrderOperation.create({
        data: {
          productionOrderId: order.id, workCenterId: op.workCenterId,
          sequence: op.sequence, name: op.name, status,
          plannedMinutes: minutes, scheduledStart: start, scheduledEnd: end,
          completedQuantity: status === "COMPLETED" ? qty.toFixed(4) : "0.0000",
        },
      });
      cursor = end;
    }
    // The order's own window follows from its operations, exactly as the
    // scheduling endpoint does it — otherwise the board's dates contradict
    // the plan sitting underneath them.
    await db.productionOrder.update({
      where: { id: order.id },
      data: { plannedStartDate: firstStart, plannedEndDate: lastEnd },
    });
    scheduled++;
  }
  console.log(`  ${centreSpecs.length} work centres, routing on ${boms.length} BOMs, ${scheduled} orders scheduled`);
}

async function finance(ctx) {
  const { db, admin, pick } = ctx;
  console.log("finance…");

  const purchaseOrders = await db.purchaseOrder.findMany({
    where: { status: { in: ["PARTIALLY_RECEIVED", "RECEIVED", "ACKNOWLEDGED", "SENT"] } },
    include: { supplier: true }, orderBy: { id: "asc" },
  });
  const salesOrders = await db.salesOrder.findMany({
    where: { status: { in: ["SHIPPED", "DELIVERED", "IN_FULFILLMENT", "APPROVED"] } },
    orderBy: { id: "asc" },
  });

  // Due dates are spread across the ageing buckets on purpose, so the finance
  // dashboard shows a real profile instead of everything sitting in "not due".
  const apOffsets = [-52, -38, -21, -12, -4, 6, 14, 25];
  const supplierInvoices = [];
  for (let i = 0; i < Math.min(purchaseOrders.length, apOffsets.length); i++) {
    const po = purchaseOrders[i];
    const sub = Number(po.subtotal ?? 0) || 100000;
    const tax = Number(po.taxAmount ?? 0) || sub * 0.18;
    supplierInvoices.push(
      await db.supplierInvoice.create({
        data: {
          invoiceNumber: `SINV-2026-${String(1 + i).padStart(5, "0")}`,
          supplierRef: `${po.supplier.code.slice(-3)}/26/${4400 + i}`,
          supplierId: po.supplierId, purchaseOrderId: po.id,
          status: i < 5 ? "APPROVED" : "AWAITING_APPROVAL",
          invoiceDate: days(apOffsets[i] - 30), dueDate: days(apOffsets[i]),
          currencyCode: po.currencyCode,
          subtotal: sub.toFixed(2), taxAmount: tax.toFixed(2),
          totalAmount: (sub + tax).toFixed(2),
          notes: "Three-way matched against the goods receipt.",
          createdById: admin.id,
          approvedById: i < 5 ? admin.id : null,
          approvedAt: i < 5 ? days(apOffsets[i] - 20) : null,
        },
      })
    );
  }

  const arOffsets = [-44, -29, -15, -6, 8, 18, 30];
  const customerInvoices = [];
  for (let i = 0; i < Math.min(salesOrders.length, arOffsets.length); i++) {
    const so = salesOrders[i];
    const sub = Number(so.subtotal ?? 0) || 120000;
    const tax = Number(so.taxAmount ?? 0) || sub * 0.18;
    customerInvoices.push(
      await db.customerInvoice.create({
        data: {
          invoiceNumber: `INV-2026-${String(1 + i).padStart(5, "0")}`,
          accountId: so.accountId, salesOrderId: so.id, status: "APPROVED",
          invoiceDate: days(arOffsets[i] - 30), dueDate: days(arOffsets[i]),
          subtotal: sub.toFixed(2), taxAmount: tax.toFixed(2),
          totalAmount: (sub + tax).toFixed(2),
          notes: "Payable within 30 days of invoice.",
          createdById: admin.id,
        },
      })
    );
  }

  // Payments go in through allocations, and the invoice balance is then
  // recomputed from those allocations — the seed never writes amountPaid by
  // hand, for the same reason the service does not.
  let payNo = 1;
  const settle = async (invoice, side, fraction, method, offset) => {
    const total = Number(invoice.totalAmount);
    const amount = Math.round(total * fraction * 100) / 100;
    if (amount <= 0) return;
    const payment = await db.payment.create({
      data: {
        paymentNumber: `PAY-2026-${String(payNo++).padStart(6, "0")}`,
        direction: side === "SUPPLIER" ? "OUTGOING" : "INCOMING",
        method,
        reference: `${method === "CHEQUE" ? "CHQ" : "UTR"}${77000 + payNo}`,
        paymentDate: days(offset),
        currencyCode: invoice.currencyCode ?? "INR",
        amount: amount.toFixed(2), unallocated: "0.00",
        supplierId: side === "SUPPLIER" ? invoice.supplierId : null,
        accountId: side === "CUSTOMER" ? invoice.accountId : null,
        recordedById: pick(payNo).id,
      },
    });
    await db.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        supplierInvoiceId: side === "SUPPLIER" ? invoice.id : null,
        customerInvoiceId: side === "CUSTOMER" ? invoice.id : null,
        amount: amount.toFixed(2),
      },
    });
    const delegate = side === "SUPPLIER" ? db.supplierInvoice : db.customerInvoice;
    const agg = await db.paymentAllocation.aggregate({
      where:
        side === "SUPPLIER"
          ? { supplierInvoiceId: invoice.id }
          : { customerInvoiceId: invoice.id },
      _sum: { amount: true },
    });
    const paid = Number(agg._sum.amount ?? 0);
    await delegate.update({
      where: { id: invoice.id },
      data: {
        amountPaid: paid.toFixed(2),
        status: paid >= total ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : invoice.status,
      },
    });
  };

  // A mix of part-paid and settled, so every status is represented on screen.
  if (supplierInvoices[0]) await settle(supplierInvoices[0], "SUPPLIER", 0.45, "BANK_TRANSFER", -18);
  if (supplierInvoices[1]) await settle(supplierInvoices[1], "SUPPLIER", 0.6, "CHEQUE", -11);
  if (supplierInvoices[4]) await settle(supplierInvoices[4], "SUPPLIER", 1, "BANK_TRANSFER", -3);
  if (customerInvoices[0]) await settle(customerInvoices[0], "CUSTOMER", 0.5, "UPI", -14);
  if (customerInvoices[1]) await settle(customerInvoices[1], "CUSTOMER", 0.35, "BANK_TRANSFER", -7);
  if (customerInvoices[3]) await settle(customerInvoices[3], "CUSTOMER", 1, "BANK_TRANSFER", -2);

  console.log(
    `  ${supplierInvoices.length} supplier invoices, ${customerInvoices.length} customer invoices, ${payNo - 1} payments`
  );
}


/**
 * Every document number in this file is written by hand, but the running
 * counters in `number_sequences` are cleared along with everything else. Left
 * alone, the first document created through the UI would be issued number 1 —
 * which already exists — and the write would fail on the unique index.
 *
 * So each family is caught up to the highest number actually on disk. The
 * prefix, period segment and padding are read back off the seeded documents
 * rather than restated here, so this cannot drift out of step with the
 * numbering service's own defaults.
 */
async function sequences(ctx) {
  const { db } = ctx;
  console.log("document numbering…");

  // Only the table and column need naming; the shape of the number is derived.
  const FAMILIES = [
    ["STOCK_MOVEMENT", db.stockMovement, "movementNumber"],
    ["STOCK_COUNT", db.stockCount, "countNumber"],
    ["PUTAWAY_TASK", db.putawayTask, "taskNumber"],
    ["PICK_LIST", db.pickList, "pickListNumber"],
    ["BOM", db.billOfMaterials, "bomNumber"],
    ["SUPPLIER", db.supplier, "code"],
    ["PURCHASE_REQUISITION", db.purchaseRequisition, "requisitionNumber"],
    ["PURCHASE_ORDER", db.purchaseOrder, "poNumber"],
    ["GOODS_RECEIPT", db.goodsReceiptNote, "grnNumber"],
    ["QUALITY_CHECK", db.qualityCheck, "qcNumber"],
    ["MATERIAL_REQUISITION", db.materialRequisition, "requisitionNumber"],
    ["PRODUCTION_ORDER", db.productionOrder, "orderNumber"],
    ["SUPPLIER_INVOICE", db.supplierInvoice, "invoiceNumber"],
    ["CUSTOMER_INVOICE", db.customerInvoice, "invoiceNumber"],
    ["PAYMENT", db.payment, "paymentNumber"],
  ];

  let synced = 0;
  for (const [key, delegate, field] of FAMILIES) {
    if (!delegate) continue;
    const rows = await delegate.findMany({ select: { [field]: true } });

    // PREFIX-PERIOD-00042 or PREFIX-00042; anything else is not ours to touch.
    let best = null;
    for (const row of rows) {
      const value = row[field];
      if (typeof value !== "string") continue;
      const parts = value.split("-");
      if (parts.length < 2) continue;
      const counter = parts[parts.length - 1];
      if (!/^\d+$/.test(counter)) continue;
      const n = parseInt(counter, 10);
      if (!best || n > best.value) {
        best = {
          value: n,
          prefix: parts[0],
          padding: counter.length,
          periodKey: parts.length >= 3 ? parts[1] : null,
        };
      }
    }
    if (!best) continue;

    await db.numberSequence.upsert({
      where: { key },
      create: {
        key,
        prefix: best.prefix,
        lastValue: best.value,
        padding: best.padding,
        resetPeriod: best.periodKey ? "YEARLY" : "NONE",
        periodKey: best.periodKey ?? "ALL",
      },
      update: {
        prefix: best.prefix,
        lastValue: best.value,
        padding: best.padding,
        resetPeriod: best.periodKey ? "YEARLY" : "NONE",
        periodKey: best.periodKey ?? "ALL",
      },
    });
    synced++;
  }

  console.log(`  ${synced} document counters caught up to the seeded data`);
}

main()
  .then(async () => {
    const counts = await prisma.$queryRawUnsafe<{ table: string; rows: number }[]>(
      `SELECT relname AS table, n_live_tup AS rows FROM pg_stat_user_tables
       WHERE schemaname='public' AND n_live_tup > 0 ORDER BY n_live_tup DESC LIMIT 14`
    );
    console.log("\nlargest tables:", counts.map(c => `${c.table}=${c.rows}`).join("  "));
    console.log("done.");
    await prisma.$disconnect();
  })
  .catch(async e => {
    console.error("SEED FAILED:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
