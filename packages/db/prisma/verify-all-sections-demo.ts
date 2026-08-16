import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Demo data verification failed: ${message}`);
  }
}

async function main() {
  const [admin, sales, assignedLead, unassignedLead] = await Promise.all([
    db.user.findUnique({ where: { email: "demo.admin@ralliwolf.example" } }),
    db.user.findUnique({ where: { email: "demo.sales@ralliwolf.example" } }),
    db.lead.findFirst({
      where: { email: "plant.manager@demo-precision.example" },
    }),
    db.lead.findFirst({
      where: { email: "unassigned.enquiry@demo-ralliwolf.example" },
    }),
  ]);

  assert(
    admin?.role === "ADMIN" && admin.deletedAt === null,
    "the demo administrator must be available"
  );
  assert(
    sales?.role === "SALES" && sales.deletedAt === null,
    "the demo sales user must be available"
  );
  assert(assignedLead?.ownerId, "the assigned demo lead has no owner");
  assert(
    unassignedLead && unassignedLead.ownerId === null,
    "the unassigned lead must remain visible without an owner"
  );

  const [products, priceBooks, campaigns, opportunity, quote, salesOrder] =
    await Promise.all([
      db.product.findMany({ where: { code: { startsWith: "DEMO-" } } }),
      db.priceBook.findMany({
        where: { name: { startsWith: "Demo " } },
        include: { priceBookEntries: true },
      }),
      db.campaign.findMany({
        where: { name: { startsWith: "Demo " } },
        include: { campaignChannels: true, campaignMembers: true },
      }),
      db.opportunity.findUnique({
        where: { opportunityNumber: "DEMO-OPP-2026-001" },
        include: { lineItems: true },
      }),
      db.quote.findUnique({
        where: { quoteNumber: "DEMO-QT-2026-001" },
        include: { lineItems: true },
      }),
      db.salesOrder.findUnique({
        where: { orderNumber: "DEMO-SO-2026-001" },
        include: { lineItems: true },
      }),
    ]);

  assert(
    products.length === 5,
    `expected 5 demo products, found ${products.length}`
  );
  assert(
    priceBooks.length === 2 &&
      priceBooks.reduce(
        (total, book) => total + book.priceBookEntries.length,
        0
      ) === 6,
    "price books must contain six persisted sortable entries"
  );
  assert(
    campaigns.length === 2 &&
      campaigns.every(
        campaign =>
          campaign.campaignChannels.length > 0 &&
          campaign.campaignMembers.length > 0
      ),
    "each demo campaign must have a channel and a member"
  );
  assert(
    opportunity?.lineItems.length === 1,
    "opportunity line item is missing"
  );
  assert(quote?.lineItems.length === 1, "quote line item is missing");
  assert(
    salesOrder?.lineItems.length === 1,
    "sales-order line item is missing"
  );
  assert(
    quote?.opportunityId === opportunity.id,
    "quote is not linked to opportunity"
  );
  assert(
    salesOrder?.quoteId === quote.id,
    "sales order is not linked to quote"
  );

  const warehouse = await db.warehouse.findUnique({
    where: { code: "DEMO-WH-MUM" },
    include: { zones: true, bins: true },
  });
  assert(warehouse, "demo warehouse is missing");
  assert(warehouse.zones.length === 7, "demo warehouse must have seven zones");
  assert(warehouse.bins.length === 7, "demo warehouse must have seven bins");

  const lots = await db.stockLot.findMany({
    where: { lotNumber: { startsWith: "DEMO-LOT-" } },
    include: { balances: true },
  });
  assert(lots.length === 4, `expected 4 demo stock lots, found ${lots.length}`);
  for (const lot of lots) {
    const balanceTotal = lot.balances.reduce(
      (total, balance) => total + Number(balance.quantity),
      0
    );
    assert(
      Math.abs(balanceTotal - Number(lot.remainingQuantity)) < 0.000001,
      `${lot.lotNumber} balance does not match its remaining quantity`
    );
  }

  const [purchaseOrder, goodsReceipt, qualityCheck] = await Promise.all([
    db.purchaseOrder.findUnique({
      where: { poNumber: "DEMO-PO-2026-001" },
      include: { lines: true },
    }),
    db.goodsReceiptNote.findUnique({
      where: { grnNumber: "DEMO-GRN-2026-001" },
      include: { lines: true },
    }),
    db.qualityCheck.findUnique({
      where: { qcNumber: "DEMO-QC-2026-001" },
      include: { parameters: true },
    }),
  ]);
  assert(purchaseOrder?.lines.length === 1, "purchase-order line is missing");
  assert(goodsReceipt?.lines.length === 1, "goods-receipt line is missing");
  assert(
    goodsReceipt.purchaseOrderId === purchaseOrder.id,
    "goods receipt is not linked to its purchase order"
  );
  assert(
    Number(purchaseOrder.lines[0]?.receivedQuantity) === 20 &&
      Number(goodsReceipt.lines[0]?.receivedQuantity) === 20,
    "purchase order and receipt quantities do not agree"
  );
  assert(
    qualityCheck?.result === "PASS" &&
      qualityCheck.parameters.length === 2 &&
      qualityCheck.parameters.every(parameter => parameter.isPassed),
    "quality-check results are incomplete"
  );

  const [bom, productionOrder, materialRequisition, pickList, packageRecord] =
    await Promise.all([
      db.billOfMaterials.findUnique({
        where: { bomNumber: "DEMO-BOM-DRILL-001" },
        include: { components: { include: { substitutes: true } } },
      }),
      db.productionOrder.findUnique({
        where: { orderNumber: "DEMO-PRO-2026-001" },
        include: { components: true, consumption: true },
      }),
      db.materialRequisition.findUnique({
        where: { requisitionNumber: "DEMO-MR-2026-001" },
        include: { lines: true },
      }),
      db.pickList.findUnique({
        where: { pickListNumber: "DEMO-PCK-2026-001" },
        include: { tasks: true },
      }),
      db.package.findUnique({
        where: { packageNumber: "DEMO-PKG-2026-001" },
        include: { lines: true },
      }),
    ]);
  assert(
    bom?.components.length === 3 &&
      bom.components.some(component => component.substitutes.length === 1),
    "BOM components or substitute are missing"
  );
  assert(
    productionOrder?.components.length === 3 &&
      productionOrder.consumption.length === 2,
    "production components or consumptions are missing"
  );
  assert(
    materialRequisition?.lines.length === 3,
    "material-requisition lines are missing"
  );
  assert(pickList?.tasks.length === 1, "pick task is missing");
  assert(packageRecord?.lines.length === 1, "package line is missing");
  assert(
    packageRecord.pickListId === pickList.id,
    "package is not linked to its pick list"
  );

  const [approvals, notifications, demoConfig, integrationCredentials] =
    await Promise.all([
      db.approvalProcess.count({
        where: {
          targetObjectName: {
            in: ["QUOTE", "PURCHASE_ORDER", "PURCHASE_REQUISITION", "BOM"],
          },
        },
      }),
      db.notification.count({ where: { title: { startsWith: "Demo " } } }),
      db.appConfig.findUnique({ where: { key: "demo.data.version" } }),
      db.integrationCredential.count(),
    ]);
  assert(approvals >= 4, "approval workflow examples are missing");
  assert(notifications >= 3, "demo notifications are missing");
  assert(demoConfig?.plainValue === "1", "demo data version marker is missing");

  console.table([
    { area: "Identity and leads", result: "verified" },
    { area: "Catalog and price books", result: "verified" },
    { area: "Campaigns and sales", result: "verified" },
    { area: "Warehouse and inventory", result: "verified" },
    { area: "Purchasing and quality", result: "verified" },
    { area: "BOM and production", result: "verified" },
    { area: "Fulfillment and workflow", result: "verified" },
  ]);
  console.log(
    `Demo data verification passed. Live integration credentials present: ${integrationCredentials}.`
  );
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
