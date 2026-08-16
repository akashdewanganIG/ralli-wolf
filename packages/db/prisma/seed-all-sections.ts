import { PrismaClient } from "@prisma/client";
import { seedSupplyChainReference } from "./seed-supply-chain.js";

/**
 * Non-destructive, repeatable demo data for every user-facing application
 * module. All natural identifiers use the DEMO prefix so this data remains
 * distinguishable from customer records and can be safely refreshed.
 */
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
  },
});

// The delegates share the same CRUD shape but Prisma intentionally generates
// a different generic type for each model. Keeping that plumbing dynamic makes
// this seed readable while all field names remain checked at runtime by Prisma.
const db = prisma as any;
const DEMO = "[DEMO]";
const PASSWORD_HASH =
  "$2a$10$zkwJCafrQjcLn2.Z1bJA.OKYuQ/RVFL6w2pKEFWY5387H/ET4zmOu"; // admin123

const now = new Date();
const daysFromNow = (days: number) =>
  new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

async function ensure(
  delegate: any,
  where: Record<string, unknown>,
  data: Record<string, unknown>
) {
  const existing = await delegate.findFirst({ where });
  if (existing) {
    return delegate.update({ where: { id: existing.id }, data });
  }
  return delegate.create({ data: { ...where, ...data } });
}

async function seedUsersAndCrm() {
  const admin = await db.user.upsert({
    where: { email: "demo.admin@ralliwolf.example" },
    update: { deletedAt: null },
    create: {
      email: "demo.admin@ralliwolf.example",
      firstName: "Demo",
      lastName: "Administrator",
      passwordHash: PASSWORD_HASH,
      role: "ADMIN",
      phone: "9000000101",
      countryCode: "91",
      location: "Mumbai",
    },
  });
  const sales = await db.user.upsert({
    where: { email: "demo.sales@ralliwolf.example" },
    update: { deletedAt: null },
    create: {
      email: "demo.sales@ralliwolf.example",
      firstName: "Aarav",
      lastName: "Sharma",
      passwordHash: PASSWORD_HASH,
      role: "SALES",
      phone: "9000000102",
      countryCode: "91",
      region: "WEST_1",
      location: "Mumbai",
    },
  });

  const account = await db.account.upsert({
    where: { name: "Demo Precision Engineering" },
    update: { industry: "Industrial Manufacturing" },
    create: {
      name: "Demo Precision Engineering",
      industry: "Industrial Manufacturing",
      website: "https://demo.invalid",
    },
  });
  const contact = await db.contact.upsert({
    where: { email: "procurement@demo-precision.example" },
    update: { accountId: account.id },
    create: {
      accountId: account.id,
      name: "Neha Kulkarni",
      email: "procurement@demo-precision.example",
      phone: "9000000201",
      countryCode: "91",
      position: "Procurement Manager",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
    },
  });
  const lead = await ensure(
    db.lead,
    { email: "plant.manager@demo-precision.example" },
    {
      firstName: "Rohan",
      lastName: "Mehta",
      phone: "9000000202",
      countryCode: "91",
      companyName: account.name,
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
      source: "LANDING_PAGE",
      status: "QUALIFIED",
      ownerId: sales.id,
      assignedAt: daysFromNow(-8),
      score: 86,
      qualityScore: 92,
      completenessScore: 95,
      missingFields: [],
      invalidFields: [],
      deletedAt: null,
    }
  );
  await ensure(
    db.lead,
    { email: "unassigned.enquiry@demo-ralliwolf.example" },
    {
      firstName: "Ishaan",
      lastName: "Verma",
      phone: "9000000203",
      countryCode: "91",
      companyName: "Demo Independent Workshop",
      city: "Ahmedabad",
      state: "Gujarat",
      pincode: "380001",
      source: "MANUAL",
      status: "OPEN",
      ownerId: null,
      assignedAt: null,
      score: 48,
      qualityScore: 72,
      completenessScore: 80,
      missingFields: ["ownerId"],
      invalidFields: [],
      deletedAt: null,
    }
  );

  const landing = await db.landingPageCampaign.upsert({
    where: { uniqueId: "DEMO-LP-INDUSTRIAL-TOOLS" },
    update: { status: "ACTIVE", createdBy: admin.id },
    create: {
      uniqueId: "DEMO-LP-INDUSTRIAL-TOOLS",
      name: "Industrial Tools Product Enquiries",
      description: `${DEMO} Qualified enquiries from the industrial tools landing page.`,
      status: "ACTIVE",
      createdBy: admin.id,
    },
  });
  await ensure(
    db.enquiry,
    { leadId: lead.id, landingPageCampaignId: landing.id },
    {
      status: "IN_PROGRESS",
      customFields: {
        productInterest: "Professional drill kit",
        monthlyVolume: "25 units",
      },
      enquiryCreatedAt: daysFromNow(-8),
    }
  );

  const keyword = await db.keyword.upsert({
    where: { name: "Demo high-intent buyer" },
    update: {},
    create: { name: "Demo high-intent buyer" },
  });
  await db.leadKeyword.upsert({
    where: { leadId_keywordId: { leadId: lead.id, keywordId: keyword.id } },
    update: {},
    create: { leadId: lead.id, keywordId: keyword.id },
  });
  await db.contactKeyword.upsert({
    where: {
      contactId_keywordId: { contactId: contact.id, keywordId: keyword.id },
    },
    update: {},
    create: { contactId: contact.id, keywordId: keyword.id },
  });
  await db.accountKeyword.upsert({
    where: {
      accountId_keywordId: { accountId: account.id, keywordId: keyword.id },
    },
    update: {},
    create: { accountId: account.id, keywordId: keyword.id },
  });
  await db.customField.upsert({
    where: { entityType_entityId: { entityType: "LEAD", entityId: lead.id } },
    update: { fields: { preferredContactTime: "10:00-12:00", demo: true } },
    create: {
      entityType: "LEAD",
      entityId: lead.id,
      fields: { preferredContactTime: "10:00-12:00", demo: true },
    },
  });
  await ensure(
    db.leadRemark,
    { leadId: lead.id, userId: sales.id },
    { remark: `${DEMO} Requested an on-site product demonstration.` }
  );
  await ensure(
    db.formSubmission,
    { leadId: lead.id },
    {
      formData: {
        form: "industrial-tools-enquiry",
        campaign: landing.uniqueId,
        consent: true,
      },
      submittedAt: daysFromNow(-8),
    }
  );
  await ensure(
    db.leadAssignmentRule,
    { name: "Demo West region assignment" },
    {
      criteria: { region: ["WEST_1", "WEST_2"], minimumScore: 60 },
      assignedUserId: sales.id,
      priority: 10,
      active: true,
    }
  );

  return { admin, sales, account, contact, lead, landing };
}

async function seedCatalog() {
  await db.currency.upsert({
    where: { code: "INR" },
    update: {},
    create: {
      code: "INR",
      name: "Indian Rupee",
      symbol: "₹",
      country: "India",
    },
  });
  const finishedCategory = await db.productCategory.upsert({
    where: { name: "Demo Power Tools" },
    update: {},
    create: {
      name: "Demo Power Tools",
      description: `${DEMO} Finished goods used throughout sales and WMS demos.`,
    },
  });
  const materialCategory = await db.productCategory.upsert({
    where: { name: "Demo Manufacturing Materials" },
    update: {},
    create: {
      name: "Demo Manufacturing Materials",
      description: `${DEMO} Raw materials and components for production.`,
    },
  });
  const ea = await db.unitOfMeasure.findUniqueOrThrow({
    where: { code: "EA" },
  });
  const kg = await db.unitOfMeasure.findUniqueOrThrow({
    where: { code: "KG" },
  });

  const productSeeds = [
    {
      code: "DEMO-FG-DRILL-20V",
      name: "Demo 20V Professional Drill Kit",
      categoryId: finishedCategory.id,
      uomId: ea.id,
      itemType: "FINISHED_GOOD",
      trackingType: "SERIAL",
      standardCost: "6450",
      active: true,
      component: false,
      isPurchasable: false,
      isSellable: true,
      isManufactured: true,
      isStockTracked: true,
      hsnCode: "84672100",
      barcode: "8900000001001",
      description: `${DEMO} Finished product with a complete BOM and sales history.`,
    },
    {
      code: "DEMO-RM-STEEL",
      name: "Demo Alloy Steel",
      categoryId: materialCategory.id,
      uomId: kg.id,
      itemType: "RAW_MATERIAL",
      trackingType: "BATCH",
      standardCost: "92",
      active: true,
      component: true,
      isPurchasable: true,
      isSellable: false,
      isManufactured: false,
      isStockTracked: true,
      barcode: "8900000001002",
      description: `${DEMO} Batch-tracked steel used in drill assemblies.`,
    },
    {
      code: "DEMO-CMP-MOTOR",
      name: "Demo Brushless Motor Assembly",
      categoryId: materialCategory.id,
      uomId: ea.id,
      itemType: "COMPONENT",
      trackingType: "BATCH",
      standardCost: "1850",
      active: true,
      component: true,
      isPurchasable: true,
      isSellable: false,
      isManufactured: false,
      isStockTracked: true,
      barcode: "8900000001003",
      description: `${DEMO} Primary motor component.`,
    },
    {
      code: "DEMO-CMP-MOTOR-ALT",
      name: "Demo Alternate Motor Assembly",
      categoryId: materialCategory.id,
      uomId: ea.id,
      itemType: "COMPONENT",
      trackingType: "BATCH",
      standardCost: "1925",
      active: true,
      component: true,
      isPurchasable: true,
      isSellable: false,
      isManufactured: false,
      isStockTracked: true,
      barcode: "8900000001004",
      description: `${DEMO} Approved substitute motor.`,
    },
    {
      code: "DEMO-PKG-CASE",
      name: "Demo Carry Case",
      categoryId: materialCategory.id,
      uomId: ea.id,
      itemType: "PACKAGING",
      trackingType: "NONE",
      standardCost: "420",
      active: true,
      component: true,
      isPurchasable: true,
      isSellable: false,
      isManufactured: false,
      isStockTracked: true,
      barcode: "8900000001005",
      description: `${DEMO} Protective retail case.`,
    },
  ];
  const products: Record<string, any> = {};
  for (const seed of productSeeds) {
    products[seed.code] = await db.product.upsert({
      where: { code: seed.code },
      update: seed,
      create: seed,
    });
  }

  const priceBook = await db.priceBook.upsert({
    where: { name: "Demo India Standard Price Book" },
    update: { isActive: true },
    create: {
      name: "Demo India Standard Price Book",
      currencyCode: "INR",
      isActive: true,
      description: `${DEMO} Standard list prices for demo products.`,
    },
  });
  const dealerPriceBook = await db.priceBook.upsert({
    where: { name: "Demo Dealer Price Book" },
    update: { isActive: true },
    create: {
      name: "Demo Dealer Price Book",
      currencyCode: "INR",
      isActive: true,
      description: `${DEMO} Dealer pricing for demo products.`,
    },
  });
  const prices: Record<string, any> = {};
  for (const [code, listPrice] of [
    ["DEMO-FG-DRILL-20V", "11999"],
    ["DEMO-RM-STEEL", "125"],
    ["DEMO-CMP-MOTOR", "2450"],
    ["DEMO-CMP-MOTOR-ALT", "2575"],
    ["DEMO-PKG-CASE", "650"],
  ] as const) {
    prices[code] = await db.priceBookEntry.upsert({
      where: {
        productId_priceBookId: {
          productId: products[code].id,
          priceBookId: priceBook.id,
        },
      },
      update: { listPrice, isActive: true },
      create: {
        productId: products[code].id,
        priceBookId: priceBook.id,
        listPrice,
        isActive: true,
        useStandardPrice: true,
      },
    });
  }
  await db.priceBookEntry.upsert({
    where: {
      productId_priceBookId: {
        productId: products["DEMO-FG-DRILL-20V"].id,
        priceBookId: dealerPriceBook.id,
      },
    },
    update: { listPrice: "10500", isActive: true },
    create: {
      productId: products["DEMO-FG-DRILL-20V"].id,
      priceBookId: dealerPriceBook.id,
      listPrice: "10500",
      isActive: true,
      useStandardPrice: false,
    },
  });
  await ensure(
    db.productOption,
    {
      productId: products["DEMO-FG-DRILL-20V"].id,
      configuredProduct: "Battery capacity",
      productOption: "4.0 Ah",
    },
    { sortOrder: 1, required: true, isActive: true }
  );

  return { products, priceBook, dealerPriceBook, prices, ea, kg };
}

async function seedCampaigns(context: any) {
  const { admin, contact, lead } = context;
  const segment = await db.segment.upsert({
    where: {
      name_entityType: {
        name: "Demo West India Qualified Leads",
        entityType: "LEAD",
      },
    },
    update: { updatedBy: admin.id },
    create: {
      name: "Demo West India Qualified Leads",
      description: `${DEMO} Qualified leads from Maharashtra and Gujarat.`,
      entityType: "LEAD",
      logicOperator: "AND",
      filtersJson: { status: ["QUALIFIED"], state: ["Maharashtra"] },
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });
  await ensure(
    db.segmentRule,
    { segmentId: segment.id, ruleType: "STATE", operator: "IN" },
    { value: ["Maharashtra", "Gujarat"] }
  );
  await ensure(
    db.segmentRule,
    { segmentId: segment.id, ruleType: "CITY", operator: "IN" },
    { value: ["Mumbai", "Pune", "Ahmedabad"] }
  );

  const emailCampaign = await ensure(
    db.campaign,
    { name: "Demo Industrial Tool Launch" },
    {
      description: `${DEMO} Email launch campaign for the professional drill range.`,
      startDate: daysFromNow(-14),
      endDate: daysFromNow(14),
      createdBy: admin.id,
    }
  );
  await db.campaignChannel.upsert({
    where: {
      campaignId_channelType_externalId: {
        campaignId: emailCampaign.id,
        channelType: "EMAIL",
        externalId: "DEMO-EMAIL-LAUNCH-2026",
      },
    },
    update: {},
    create: {
      campaignId: emailCampaign.id,
      channelType: "EMAIL",
      externalId: "DEMO-EMAIL-LAUNCH-2026",
    },
  });
  const emailMember = await ensure(
    db.campaignMember,
    { campaignId: emailCampaign.id, contactId: contact.id },
    { leadId: null, status: "active", joinedAt: daysFromNow(-12) }
  );

  const whatsAppCampaign = await ensure(
    db.campaign,
    { name: "Demo Dealer WhatsApp Follow-up" },
    {
      description: `${DEMO} WhatsApp follow-up campaign with delivery analytics.`,
      startDate: daysFromNow(-5),
      endDate: daysFromNow(7),
      createdBy: admin.id,
    }
  );
  await db.campaignChannel.upsert({
    where: {
      campaignId_channelType_externalId: {
        campaignId: whatsAppCampaign.id,
        channelType: "WHATSAPP",
        externalId: "DEMO-WA-FOLLOWUP-2026",
      },
    },
    update: {},
    create: {
      campaignId: whatsAppCampaign.id,
      channelType: "WHATSAPP",
      externalId: "DEMO-WA-FOLLOWUP-2026",
    },
  });
  const whatsAppMember = await ensure(
    db.campaignMember,
    { campaignId: whatsAppCampaign.id, leadId: lead.id },
    { contactId: null, status: "active", joinedAt: daysFromNow(-4) }
  );

  const whatsAppNumber = await db.whatsAppNumber.upsert({
    where: { phoneNumber: "919000000999" },
    update: { status: "INACTIVE", updatedBy: admin.id },
    create: {
      displayName: "Demo Ralli Wolf Notifications",
      phoneNumber: "919000000999",
      provider: "MSG91",
      businessId: "DEMO-BUSINESS-ID",
      senderId: "DEMO-SENDER-ID",
      encryptedApiKey: "demo-disabled-credential",
      iv: "demo-disabled-iv",
      authTag: "demo-disabled-auth-tag",
      maskedTail: "MO99",
      metadata: { demo: true, externalCallsDisabled: true },
      status: "INACTIVE",
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });
  const template = await db.whatsAppTemplate.upsert({
    where: {
      whatsappNumberId_providerTemplateId: {
        whatsappNumberId: whatsAppNumber.id,
        providerTemplateId: "DEMO_TOOL_FOLLOWUP_V1",
      },
    },
    update: { status: "APPROVED", isArchived: false },
    create: {
      whatsappNumberId: whatsAppNumber.id,
      providerTemplateId: "DEMO_TOOL_FOLLOWUP_V1",
      name: "demo_tool_followup",
      language: "en",
      category: "MARKETING",
      status: "APPROVED",
      components: [
        {
          type: "BODY",
          text: "Hi {{1}}, your requested product demonstration is ready.",
        },
      ],
      lastSyncedAt: daysFromNow(-1),
    },
  });
  await db.whatsAppCampaignConfig.upsert({
    where: { campaignId: whatsAppCampaign.id },
    update: {
      whatsappNumberId: whatsAppNumber.id,
      templateId: template.id,
      segmentId: segment.id,
    },
    create: {
      campaignId: whatsAppCampaign.id,
      whatsappNumberId: whatsAppNumber.id,
      templateId: template.id,
      segmentId: segment.id,
      language: "en",
      batchSize: 50,
      messageParams: { body_1: "Rohan" },
      scheduledAt: daysFromNow(2),
    },
  });

  const emailDelivery = await ensure(
    db.campaignDelivery,
    {
      campaignId: emailCampaign.id,
      channel: "email",
      address: contact.email,
    },
    {
      campaignMemberId: emailMember.id,
      contactId: contact.id,
      status: "READ",
      providerMessageId: "DEMO-EMAIL-MESSAGE-001",
      sentAt: daysFromNow(-11),
      deliveredAt: daysFromNow(-11),
      readAt: daysFromNow(-10),
      webhookPayload: { demo: true, event: "opened" },
    }
  );
  const waDelivery = await ensure(
    db.campaignDelivery,
    {
      campaignId: whatsAppCampaign.id,
      channel: "whatsapp",
      address: lead.phone || "9000000202",
    },
    {
      campaignMemberId: whatsAppMember.id,
      leadId: lead.id,
      whatsappNumberId: whatsAppNumber.id,
      segmentId: segment.id,
      status: "DELIVERED",
      providerMessageId: "DEMO-WA-MESSAGE-001",
      sentAt: daysFromNow(-3),
      deliveredAt: daysFromNow(-3),
      csvData: { firstName: lead.firstName, demo: true },
    }
  );
  await ensure(
    db.webhookEvent,
    { correlationId: "DEMO-WEBHOOK-EMAIL-001" },
    {
      provider: "demo-provider",
      eventType: "email.opened",
      payload: { demo: true, deliveryId: emailDelivery.id },
      processed: true,
      processedAt: daysFromNow(-10),
      campaignDeliveryId: emailDelivery.id,
    }
  );
  await db.optOut.upsert({
    where: { phone_channel: { phone: "919000000777", channel: "whatsapp" } },
    update: { campaignId: whatsAppCampaign.id },
    create: {
      phone: "919000000777",
      channel: "whatsapp",
      campaignId: whatsAppCampaign.id,
      source: "recipient_reply",
      reason: `${DEMO} Recipient requested no promotional messages.`,
      metadata: { keyword: "STOP", demo: true },
      optedOutAt: daysFromNow(-2),
    },
  });
  await ensure(
    db.analyticsEvent,
    { campaignId: emailCampaign.id, contactId: contact.id, eventType: "open" },
    {
      eventData: { demo: true, device: "desktop", source: "email" },
      occurredAt: daysFromNow(-10),
    }
  );
  await ensure(
    db.analyticsEvent,
    {
      campaignId: whatsAppCampaign.id,
      leadId: lead.id,
      eventType: "delivered",
    },
    {
      eventData: {
        demo: true,
        providerMessageId: waDelivery.providerMessageId,
      },
      occurredAt: daysFromNow(-3),
    }
  );

  return { segment, emailCampaign, whatsAppCampaign };
}

async function seedSales(context: any, catalog: any) {
  const { admin, sales, account, contact } = context;
  const product = catalog.products["DEMO-FG-DRILL-20V"];
  const price = catalog.prices["DEMO-FG-DRILL-20V"];
  const opportunity = await db.opportunity.upsert({
    where: { opportunityNumber: "DEMO-OPP-2026-001" },
    update: { deletedAt: null },
    create: {
      opportunityNumber: "DEMO-OPP-2026-001",
      name: "Demo Precision plant tool upgrade",
      description: `${DEMO} Plant-wide cordless drill replacement opportunity.`,
      stage: "NEGOTIATION",
      type: "EXISTING_CUSTOMER_REPLACEMENT",
      status: "QUOTE_CREATED",
      amount: "599950",
      probability: 75,
      expectedCloseDate: daysFromNow(21),
      leadSource: "LANDING_PAGE",
      nextStep: "Review commercial terms",
      accountId: account.id,
      contactId: contact.id,
      priceBookId: catalog.priceBook.id,
      ownerId: sales.id,
      createdBy: admin.id,
    },
  });
  await ensure(
    db.opportunityLineItem,
    { opportunityId: opportunity.id, productId: product.id },
    {
      priceBookEntryId: price.id,
      quantity: 50,
      listPrice: "11999",
      unitPrice: "11399.05",
      discount: "5",
      totalPrice: "569952.50",
      description: `${DEMO} Drill kits including cases.`,
      sortOrder: 1,
    }
  );
  await ensure(
    db.opportunityActivity,
    {
      opportunityId: opportunity.id,
      activityType: "CUSTOMER_MEETING",
    },
    {
      userId: sales.id,
      description: `${DEMO} Commercial negotiation completed with procurement.`,
      metadata: { outcome: "positive", nextReview: daysFromNow(5) },
      createdAt: daysFromNow(-2),
    }
  );

  const quote = await db.quote.upsert({
    where: { quoteNumber: "DEMO-QT-2026-001" },
    update: {},
    create: {
      quoteNumber: "DEMO-QT-2026-001",
      name: "Demo Precision drill replacement quote",
      description: `${DEMO} Approved commercial quote.`,
      status: "APPROVED",
      type: "QUOTE",
      version: 1,
      isPrimary: true,
      subtotal: "569952.50",
      discount: "29997.50",
      discountPercent: "5",
      taxAmount: "102591.45",
      taxPercent: "18",
      shippingAmount: "5000",
      grandTotal: "677543.95",
      validUntil: daysFromNow(30),
      approvedAt: daysFromNow(-1),
      billingName: account.name,
      billingCity: "Pune",
      billingState: "Maharashtra",
      billingCountry: "India",
      shippingName: `${account.name} Plant 1`,
      shippingCity: "Pune",
      shippingState: "Maharashtra",
      shippingCountry: "India",
      paymentTerms: "Net 30",
      deliveryTerms: "Delivered duty paid",
      notes: `${DEMO} Prices valid for thirty days.`,
      opportunityId: opportunity.id,
      accountId: account.id,
      contactId: contact.id,
      preparedById: sales.id,
      approvedById: admin.id,
    },
  });
  await ensure(
    db.quoteLineItem,
    { quoteId: quote.id, productId: product.id },
    {
      priceBookEntryId: price.id,
      quantity: 50,
      listPrice: "11999",
      unitPrice: "11399.05",
      discount: "5",
      totalPrice: "569952.50",
      description: `${DEMO} Professional drill kits.`,
      sortOrder: 1,
    }
  );
  const salesOrder = await db.salesOrder.upsert({
    where: { orderNumber: "DEMO-SO-2026-001" },
    update: {},
    create: {
      orderNumber: "DEMO-SO-2026-001",
      name: "Demo Precision drill order",
      description: `${DEMO} Approved order awaiting fulfillment.`,
      status: "IN_FULFILLMENT",
      subtotal: "569952.50",
      discount: "29997.50",
      discountPercent: "5",
      taxAmount: "102591.45",
      taxPercent: "18",
      shippingAmount: "5000",
      grandTotal: "677543.95",
      orderDate: daysFromNow(-1),
      expectedShipDate: daysFromNow(6),
      expectedDeliveryDate: daysFromNow(9),
      approvedAt: daysFromNow(-1),
      billingName: account.name,
      billingCity: "Pune",
      billingState: "Maharashtra",
      billingCountry: "India",
      shippingName: `${account.name} Plant 1`,
      shippingCity: "Pune",
      shippingState: "Maharashtra",
      shippingCountry: "India",
      paymentTerms: "Net 30",
      deliveryTerms: "Delivered duty paid",
      quoteId: quote.id,
      accountId: account.id,
      contactId: contact.id,
      ownerId: sales.id,
      approvedById: admin.id,
    },
  });
  await ensure(
    db.salesOrderLineItem,
    { salesOrderId: salesOrder.id, productId: product.id },
    {
      quantity: 50,
      listPrice: "11999",
      unitPrice: "11399.05",
      discount: "5",
      totalPrice: "569952.50",
      description: `${DEMO} Fulfillment quantity.`,
      sortOrder: 1,
    }
  );
  await ensure(
    db.approvalProcess,
    { targetObjectName: "QUOTE", targetRecordId: quote.id },
    {
      status: "APPROVED",
      comment: `${DEMO} Commercial terms approved.`,
      requestedToId: admin.id,
      lastActorId: admin.id,
      createdById: sales.id,
      completedDate: daysFromNow(-1),
    }
  );
  await ensure(
    db.notification,
    {
      userId: sales.id,
      title: "Demo quote approved",
      link: `/sales/quotes/${quote.id}`,
    },
    {
      type: "APPROVAL_APPROVED",
      message: "Demo quote DEMO-QT-2026-001 was approved.",
      isRead: false,
    }
  );

  return { opportunity, quote, salesOrder };
}

async function seedChatbotAndDealer(context: any, catalog: any) {
  const { admin, sales, contact } = context;
  const session = await ensure(
    db.botSession,
    { contactId: contact.id, userId: sales.id, status: "COMPLETED" },
    {
      startedAt: daysFromNow(-3),
      endedAt: daysFromNow(-3),
    }
  );
  await ensure(
    db.chatHistory,
    { sessionId: session.id, sender: "CONTACT" },
    {
      contactId: contact.id,
      message:
        "Do you have a professional cordless drill for plant maintenance?",
      createdAt: daysFromNow(-3),
    }
  );
  await ensure(
    db.chatHistory,
    { sessionId: session.id, sender: "BOT" },
    {
      contactId: contact.id,
      message:
        "Yes. The Demo 20V Professional Drill Kit is designed for industrial maintenance.",
      createdAt: daysFromNow(-3),
    }
  );
  await ensure(
    db.knowledgeBase,
    { title: "Demo 20V drill product guide" },
    {
      content:
        "The Demo 20V Professional Drill Kit includes a brushless motor, carry case, and industrial warranty.",
      sourceUrl: "https://demo.invalid/products/drill-guide",
    }
  );

  const dealer = await db.subdealer.upsert({
    where: { phone: "9000000301" },
    update: { phoneVerified: true },
    create: {
      phone: "9000000301",
      gstNumber: "27DEMO0000A1Z5",
      email: "orders@demo-dealer.example",
      legalName: "Demo Maharashtra Tools LLP",
      tradeName: "Demo Tools Dealer",
      address: "100 Industrial Estate",
      city: "Nashik",
      state: "Maharashtra",
      pincode: "422001",
      panNumber: "DEMOA0000A",
      registrationDate: daysFromNow(-365),
      businessType: "LLP",
      status: "ACTIVE",
      jurisdiction: "Nashik",
      phoneVerified: true,
      verifiedAt: daysFromNow(-30),
    },
  });
  await ensure(
    db.invoice,
    { pdfUrl: "https://demo.invalid/invoices/DEMO-INV-001.pdf" },
    {
      uploadedBy: dealer.id,
      category: "PENDING",
      status: "pending_review",
    }
  );
  const dealerOrder = await db.order.upsert({
    where: { orderNumber: "DEMO-DEALER-ORDER-001" },
    update: { archived: false },
    create: {
      orderNumber: "DEMO-DEALER-ORDER-001",
      totalAmount: "23998",
      city: "Nashik",
      contactNumber: dealer.phone,
      email: dealer.email,
      firmName: dealer.tradeName,
      ownerFirstName: "Karan",
      ownerLastName: "Patil",
      pincode: dealer.pincode,
      state: dealer.state,
      gst: dealer.gstNumber,
      salesUserId: sales.id,
      archived: false,
    },
  });
  await ensure(
    db.productLineItem,
    {
      orderId: dealerOrder.id,
      productId: catalog.products["DEMO-FG-DRILL-20V"].id,
    },
    { quantity: 2, unitPrice: "11999", totalPrice: "23998" }
  );
  await ensure(
    db.auditLog,
    {
      entityType: "Order",
      entityId: dealerOrder.id,
      action: "DEMO_CREATED",
    },
    {
      changedBy: admin.id,
      category: "SALES_MANAGEMENT",
      subCategory: "DEALER_ORDER",
      newValues: { orderNumber: dealerOrder.orderNumber, demo: true },
    }
  );
}

async function seedSupplyChain(context: any, catalog: any, salesData: any) {
  const { admin, sales } = context;
  const { products, ea, kg } = catalog;
  const warehouse = await db.warehouse.upsert({
    where: { code: "DEMO-WH-MUM" },
    update: { isActive: true },
    create: {
      code: "DEMO-WH-MUM",
      name: "Demo Mumbai Distribution & Assembly",
      type: "PLANT",
      addressLine1: "100 Demo Industrial Estate",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400001",
      country: "India",
      contactName: "Demo Warehouse Desk",
      contactPhone: "9000000401",
      contactEmail: "warehouse@demo-ralliwolf.example",
      isActive: true,
      isDefault: false,
      allowNegativeStock: false,
    },
  });
  await ensure(
    db.warehouseImage,
    {
      warehouseId: warehouse.id,
      url: "https://placehold.co/1200x800/991b1b/ffffff?text=Demo+Warehouse",
    },
    { sortOrder: 1 }
  );

  const zoneSeeds = [
    ["RCV", "Receiving", "RECEIVING"],
    ["STO", "Bulk Storage", "STORAGE"],
    ["PCK", "Fast Pick", "PICKING"],
    ["PAK", "Packing", "PACKING"],
    ["SHP", "Shipping", "SHIPPING"],
    ["QUA", "Quality Quarantine", "QUARANTINE"],
    ["PRD", "Production Staging", "PRODUCTION"],
  ] as const;
  const zones: Record<string, any> = {};
  for (const [code, name, zoneType] of zoneSeeds) {
    zones[code] = await db.warehouseZone.upsert({
      where: { warehouseId_code: { warehouseId: warehouse.id, code } },
      update: { isActive: true },
      create: {
        warehouseId: warehouse.id,
        code,
        name,
        zoneType,
        isActive: true,
      },
    });
  }
  const binSeeds = [
    ["RCV-01", "RCV", "BULK_FLOOR", 10, false, true, false, false],
    ["STO-A-01", "STO", "PALLET_RACK", 20, false, false, false, false],
    ["PCK-A-01", "PCK", "SHELF", 30, true, false, false, false],
    ["PAK-01", "PAK", "BULK_FLOOR", 40, false, false, false, false],
    ["SHP-01", "SHP", "BULK_FLOOR", 50, false, false, true, false],
    ["QUA-01", "QUA", "BIN_BOX", 60, false, false, false, true],
    ["PRD-01", "PRD", "BULK_FLOOR", 70, false, false, false, false],
  ] as const;
  const bins: Record<string, any> = {};
  for (const [
    code,
    zoneCode,
    binType,
    pickSequence,
    isPickFace,
    isReceiving,
    isShipping,
    isQuarantine,
  ] of binSeeds) {
    bins[code] = await db.storageBin.upsert({
      where: { warehouseId_code: { warehouseId: warehouse.id, code } },
      update: { isActive: true, isBlocked: false },
      create: {
        warehouseId: warehouse.id,
        zoneId: zones[zoneCode].id,
        code,
        aisle: zoneCode,
        rack: "01",
        level: "01",
        position: "01",
        binType,
        pickSequence,
        maxWeightKg: "5000",
        maxVolumeM3: "50",
        isPickFace,
        isReceiving,
        isShipping,
        isQuarantine,
        isBlocked: false,
        isActive: true,
      },
    });
  }
  const pallet = await db.pallet.upsert({
    where: { code: "DEMO-PLT-0001" },
    update: { status: "IN_USE", binId: bins["STO-A-01"].id },
    create: {
      code: "DEMO-PLT-0001",
      warehouseId: warehouse.id,
      binId: bins["STO-A-01"].id,
      status: "IN_USE",
      grossWeightKg: "420",
      notes: `${DEMO} Mixed component pallet.`,
    },
  });

  const supplier = await db.supplier.upsert({
    where: { code: "DEMO-SUP-001" },
    update: { status: "ACTIVE", isBlacklisted: false },
    create: {
      code: "DEMO-SUP-001",
      name: "Demo Apex Components Pvt Ltd",
      legalName: "Demo Apex Components Private Limited",
      status: "ACTIVE",
      email: "sales@demo-apex.example",
      phone: "9000000501",
      countryCode: "91",
      website: "https://demo-apex.invalid",
      gstNumber: "27DEMO1111A1Z5",
      panNumber: "DEMOA1111A",
      addressLine1: "25 Supplier Park",
      city: "Pune",
      state: "Maharashtra",
      postalCode: "411019",
      country: "India",
      currencyCode: "INR",
      paymentTerms: "Net 30",
      creditDays: 30,
      incoterms: "DAP",
      leadTimeDays: 7,
      minOrderValue: "10000",
      notes: `${DEMO} Preferred component supplier.`,
      createdById: admin.id,
    },
  });
  await ensure(
    db.supplierContact,
    { supplierId: supplier.id, email: "account.manager@demo-apex.example" },
    {
      name: "Priya Nair",
      designation: "Account Manager",
      phone: "9000000502",
      isPrimary: true,
    }
  );
  const supplierProducts: Record<string, any> = {};
  for (const [code, unitPrice, leadTimeDays] of [
    ["DEMO-CMP-MOTOR", "1850", 7],
    ["DEMO-CMP-MOTOR-ALT", "1925", 9],
    ["DEMO-RM-STEEL", "92", 5],
    ["DEMO-PKG-CASE", "420", 4],
  ] as const) {
    supplierProducts[code] = await ensure(
      db.supplierProduct,
      { supplierId: supplier.id, productId: products[code].id, isActive: true },
      {
        supplierSku: `APEX-${code}`,
        unitPrice,
        currencyCode: "INR",
        minOrderQuantity: "10",
        packSize: "1",
        leadTimeDays,
        isPreferred: code === "DEMO-CMP-MOTOR",
      }
    );
  }
  await db.supplierPriceTier.upsert({
    where: {
      supplierProductId_minQuantity: {
        supplierProductId: supplierProducts["DEMO-CMP-MOTOR"].id,
        minQuantity: "50",
      },
    },
    update: { unitPrice: "1775" },
    create: {
      supplierProductId: supplierProducts["DEMO-CMP-MOTOR"].id,
      minQuantity: "50",
      unitPrice: "1775",
    },
  });
  await db.supplierPerformance.upsert({
    where: {
      supplierId_periodStart_periodEnd: {
        supplierId: supplier.id,
        periodStart: new Date("2026-07-01T00:00:00.000Z"),
        periodEnd: new Date("2026-07-31T23:59:59.000Z"),
      },
    },
    update: { overallScore: "91.5" },
    create: {
      supplierId: supplier.id,
      periodStart: new Date("2026-07-01T00:00:00.000Z"),
      periodEnd: new Date("2026-07-31T23:59:59.000Z"),
      totalOrders: 6,
      totalOrderValue: "425000",
      receiptsCount: 6,
      onTimeReceipts: 5,
      lateReceipts: 1,
      onTimeDeliveryRate: "83.3333",
      receivedQuantity: "620",
      acceptedQuantity: "610",
      rejectedQuantity: "10",
      qualityAcceptanceRate: "98.3871",
      averageLeadTimeDays: "6.5",
      priceVariancePercent: "1.25",
      fillRate: "97.5",
      overallScore: "91.5",
    },
  });

  const requisition = await db.purchaseRequisition.upsert({
    where: { requisitionNumber: "DEMO-PR-2026-001" },
    update: {},
    create: {
      requisitionNumber: "DEMO-PR-2026-001",
      warehouseId: warehouse.id,
      status: "APPROVED",
      origin: "REORDER_RULE",
      requiredByDate: daysFromNow(8),
      suggestedSupplierId: supplier.id,
      estimatedValue: "37000",
      justification: `${DEMO} Motor stock reached its reorder point.`,
      requestedById: sales.id,
      approvedById: admin.id,
      approvedAt: daysFromNow(-7),
    },
  });
  const requisitionLine = await ensure(
    db.purchaseRequisitionLine,
    {
      requisitionId: requisition.id,
      productId: products["DEMO-CMP-MOTOR"].id,
    },
    {
      quantity: "20",
      orderedQuantity: "20",
      uomId: ea.id,
      estimatedUnitPrice: "1850",
      requiredByDate: daysFromNow(8),
      notes: `${DEMO} Replenishment quantity.`,
    }
  );
  const purchaseOrder = await db.purchaseOrder.upsert({
    where: { poNumber: "DEMO-PO-2026-001" },
    update: {},
    create: {
      poNumber: "DEMO-PO-2026-001",
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      requisitionId: requisition.id,
      status: "RECEIVED",
      orderDate: daysFromNow(-7),
      expectedDeliveryDate: daysFromNow(-1),
      promisedDate: daysFromNow(-1),
      currencyCode: "INR",
      exchangeRate: "1",
      subtotal: "37000",
      discountAmount: "0",
      taxAmount: "6660",
      shippingAmount: "500",
      grandTotal: "44160",
      paymentTerms: "Net 30",
      incoterms: "DAP",
      shipToAddress: "Demo Mumbai Distribution & Assembly",
      notes: `${DEMO} Completed purchase order.`,
      sentAt: daysFromNow(-7),
      acknowledgedAt: daysFromNow(-6),
      closedAt: daysFromNow(-1),
      createdById: sales.id,
      approvedById: admin.id,
      approvedAt: daysFromNow(-7),
    },
  });
  const poLine = await ensure(
    db.purchaseOrderLine,
    {
      purchaseOrderId: purchaseOrder.id,
      productId: products["DEMO-CMP-MOTOR"].id,
    },
    {
      requisitionLineId: requisitionLine.id,
      lineNumber: 1,
      description: `${DEMO} Brushless motor assemblies.`,
      quantity: "20",
      uomId: ea.id,
      unitPrice: "1850",
      taxPercent: "18",
      taxAmount: "6660",
      lineTotal: "43660",
      receivedQuantity: "20",
      acceptedQuantity: "20",
      rejectedQuantity: "0",
      expectedDate: daysFromNow(-1),
      status: "RECEIVED",
    }
  );

  const motorLot = await db.stockLot.upsert({
    where: { lotNumber: "DEMO-LOT-MOTOR-001" },
    update: { status: "ACTIVE" },
    create: {
      lotNumber: "DEMO-LOT-MOTOR-001",
      productId: products["DEMO-CMP-MOTOR"].id,
      originWarehouseId: warehouse.id,
      batchNumber: "DEMO-BATCH-MOTOR-A",
      manufacturedDate: daysFromNow(-30),
      receivedAt: daysFromNow(-1),
      originalQuantity: "20",
      remainingQuantity: "20",
      unitCost: "1850",
      status: "ACTIVE",
      supplierId: supplier.id,
      sourceType: "PURCHASE_ORDER",
      sourceReference: purchaseOrder.poNumber,
    },
  });
  const steelLot = await db.stockLot.upsert({
    where: { lotNumber: "DEMO-LOT-STEEL-001" },
    update: { status: "ACTIVE" },
    create: {
      lotNumber: "DEMO-LOT-STEEL-001",
      productId: products["DEMO-RM-STEEL"].id,
      originWarehouseId: warehouse.id,
      batchNumber: "DEMO-BATCH-STEEL-A",
      manufacturedDate: daysFromNow(-60),
      receivedAt: daysFromNow(-20),
      originalQuantity: "500",
      remainingQuantity: "490",
      unitCost: "92",
      status: "ACTIVE",
      supplierId: supplier.id,
      sourceType: "OPENING_BALANCE",
      sourceReference: "DEMO-OPENING-001",
    },
  });
  const caseLot = await db.stockLot.upsert({
    where: { lotNumber: "DEMO-LOT-CASE-001" },
    update: { status: "ACTIVE" },
    create: {
      lotNumber: "DEMO-LOT-CASE-001",
      productId: products["DEMO-PKG-CASE"].id,
      originWarehouseId: warehouse.id,
      batchNumber: "DEMO-BATCH-CASE-A",
      receivedAt: daysFromNow(-15),
      originalQuantity: "20",
      remainingQuantity: "20",
      unitCost: "420",
      status: "ACTIVE",
      supplierId: supplier.id,
      sourceType: "OPENING_BALANCE",
      sourceReference: "DEMO-OPENING-002",
    },
  });
  const finishedLot = await db.stockLot.upsert({
    where: { lotNumber: "DEMO-LOT-DRILL-001" },
    update: { status: "ACTIVE" },
    create: {
      lotNumber: "DEMO-LOT-DRILL-001",
      productId: products["DEMO-FG-DRILL-20V"].id,
      originWarehouseId: warehouse.id,
      batchNumber: "DEMO-BATCH-DRILL-A",
      manufacturedDate: daysFromNow(-4),
      receivedAt: daysFromNow(-3),
      originalQuantity: "18",
      remainingQuantity: "18",
      unitCost: "6450",
      status: "ACTIVE",
      sourceType: "PRODUCTION_ORDER",
      sourceReference: "DEMO-PRO-2026-001",
    },
  });

  const balances = [
    [
      products["DEMO-CMP-MOTOR"],
      motorLot,
      "20",
      "10",
      bins["STO-A-01"],
      pallet,
    ],
    [products["DEMO-RM-STEEL"], steelLot, "490", "0", bins["STO-A-01"], pallet],
    [products["DEMO-PKG-CASE"], caseLot, "20", "0", bins["PCK-A-01"], null],
    [
      products["DEMO-FG-DRILL-20V"],
      finishedLot,
      "18",
      "5",
      bins["PCK-A-01"],
      null,
    ],
  ] as const;
  for (const [
    product,
    lot,
    quantity,
    reservedQuantity,
    bin,
    stockPallet,
  ] of balances) {
    await ensure(
      db.stockBalance,
      {
        productId: product.id,
        warehouseId: warehouse.id,
        binId: bin.id,
        lotId: lot.id,
      },
      {
        palletId: stockPallet?.id || null,
        quantity,
        reservedQuantity,
        status: "AVAILABLE",
        lastMovementAt: daysFromNow(-1),
      }
    );
  }

  for (const movement of [
    {
      movementNumber: "DEMO-MOV-0001",
      productId: products["DEMO-RM-STEEL"].id,
      lotId: steelLot.id,
      uomId: kg.id,
      quantity: "500",
      unitCost: "92",
      totalCost: "46000",
      toBinId: bins["STO-A-01"].id,
      movementType: "OPENING_BALANCE",
      direction: "IN",
    },
    {
      movementNumber: "DEMO-MOV-0002",
      productId: products["DEMO-CMP-MOTOR"].id,
      lotId: motorLot.id,
      uomId: ea.id,
      quantity: "20",
      unitCost: "1850",
      totalCost: "37000",
      toBinId: bins["STO-A-01"].id,
      movementType: "PURCHASE_RECEIPT",
      direction: "IN",
    },
    {
      movementNumber: "DEMO-MOV-0003",
      productId: products["DEMO-RM-STEEL"].id,
      lotId: steelLot.id,
      uomId: kg.id,
      quantity: "10",
      unitCost: "92",
      totalCost: "920",
      fromBinId: bins["STO-A-01"].id,
      movementType: "PRODUCTION_CONSUMPTION",
      direction: "OUT",
    },
  ]) {
    await db.stockMovement.upsert({
      where: { movementNumber: movement.movementNumber },
      update: {},
      create: {
        ...movement,
        fromWarehouseId: movement.direction === "OUT" ? warehouse.id : null,
        toWarehouseId: movement.direction === "IN" ? warehouse.id : null,
        referenceType:
          movement.movementType === "PURCHASE_RECEIPT"
            ? "PURCHASE_ORDER"
            : movement.movementType === "PRODUCTION_CONSUMPTION"
              ? "PRODUCTION_ORDER"
              : "OPENING_BALANCE",
        referenceNumber:
          movement.movementType === "PURCHASE_RECEIPT"
            ? purchaseOrder.poNumber
            : movement.movementType === "PRODUCTION_CONSUMPTION"
              ? "DEMO-PRO-2026-001"
              : "DEMO-OPENING",
        notes: `${DEMO} Inventory ledger example.`,
        performedById: admin.id,
        occurredAt: daysFromNow(-1),
      },
    });
  }

  await db.reorderRule.upsert({
    where: {
      productId_warehouseId: {
        productId: products["DEMO-PKG-CASE"].id,
        warehouseId: warehouse.id,
      },
    },
    update: { isActive: true },
    create: {
      productId: products["DEMO-PKG-CASE"].id,
      warehouseId: warehouse.id,
      safetyStock: "25",
      reorderPoint: "50",
      reorderQuantity: "100",
      maximumStock: "250",
      leadTimeDays: 4,
      autoRequisition: true,
      preferredSupplierId: supplier.id,
      isActive: true,
      lastEvaluatedAt: now,
    },
  });
  await ensure(
    db.stockAlert,
    {
      productId: products["DEMO-PKG-CASE"].id,
      warehouseId: warehouse.id,
      alertType: "BELOW_SAFETY_STOCK",
      status: "OPEN",
    },
    {
      severity: "HIGH",
      currentQuantity: "20",
      thresholdQuantity: "25",
      shortfallQuantity: "5",
      message:
        "Demo Carry Case is below safety stock in Demo Mumbai warehouse.",
    }
  );
  await ensure(
    db.stockReservation,
    {
      productId: products["DEMO-FG-DRILL-20V"].id,
      warehouseId: warehouse.id,
      referenceType: "SALES_ORDER",
      referenceId: salesData.salesOrder.id,
    },
    {
      lotId: finishedLot.id,
      quantity: "5",
      releasedQuantity: "0",
      status: "ACTIVE",
      referenceNumber: salesData.salesOrder.orderNumber,
      expiresAt: daysFromNow(7),
      createdById: sales.id,
    }
  );

  const stockCount = await db.stockCount.upsert({
    where: { countNumber: "DEMO-CNT-2026-001" },
    update: {},
    create: {
      countNumber: "DEMO-CNT-2026-001",
      warehouseId: warehouse.id,
      countType: "CYCLE",
      status: "PENDING_APPROVAL",
      scheduledDate: daysFromNow(-1),
      startedAt: daysFromNow(-1),
      completedAt: now,
      countedById: sales.id,
      notes: `${DEMO} Variance requires supervisor review.`,
    },
  });
  await ensure(
    db.stockCountLine,
    {
      stockCountId: stockCount.id,
      productId: products["DEMO-RM-STEEL"].id,
      binId: bins["STO-A-01"].id,
    },
    {
      lotId: steelLot.id,
      systemQuantity: "490",
      countedQuantity: "488",
      varianceQuantity: "-2",
      varianceValue: "-184",
      reasonCode: "COUNT_VARIANCE",
      isPosted: false,
      notes: `${DEMO} Pending recount.`,
    }
  );

  return {
    warehouse,
    bins,
    supplier,
    requisition,
    purchaseOrder,
    poLine,
    motorLot,
    steelLot,
    caseLot,
    finishedLot,
    pallet,
  };
}

async function seedOperationalDocuments(
  context: any,
  catalog: any,
  salesData: any,
  supply: any
) {
  const { admin, sales } = context;
  const { products, ea, kg } = catalog;
  const {
    warehouse,
    bins,
    supplier,
    requisition,
    purchaseOrder,
    poLine,
    motorLot,
    steelLot,
    finishedLot,
    pallet,
  } = supply;

  const grn = await db.goodsReceiptNote.upsert({
    where: { grnNumber: "DEMO-GRN-2026-001" },
    update: {},
    create: {
      grnNumber: "DEMO-GRN-2026-001",
      purchaseOrderId: purchaseOrder.id,
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      status: "COMPLETED",
      receivedDate: daysFromNow(-1),
      supplierInvoiceNumber: "DEMO-APEX-INV-001",
      supplierInvoiceDate: daysFromNow(-2),
      vehicleNumber: "MH12DEMO01",
      lrNumber: "DEMO-LR-0001",
      isOnTime: true,
      delayDays: 0,
      totalReceivedQuantity: "20",
      totalAcceptedQuantity: "20",
      totalRejectedQuantity: "0",
      totalValue: "37000",
      notes: `${DEMO} Receipt completed and posted to inventory.`,
      postedAt: daysFromNow(-1),
      receivedById: sales.id,
    },
  });
  const grnLine = await ensure(
    db.goodsReceiptLine,
    { grnId: grn.id, productId: products["DEMO-CMP-MOTOR"].id },
    {
      purchaseOrderLineId: poLine.id,
      lineNumber: 1,
      receivedQuantity: "20",
      acceptedQuantity: "20",
      rejectedQuantity: "0",
      uomId: ea.id,
      unitCost: "1850",
      batchNumber: "DEMO-BATCH-MOTOR-A",
      serialNumbers: [],
      manufacturedDate: daysFromNow(-30),
      qcResult: "PASS",
      lotId: motorLot.id,
      putawayBinId: bins["STO-A-01"].id,
      isPosted: true,
    }
  );
  const qualityCheck = await db.qualityCheck.upsert({
    where: { qcNumber: "DEMO-QC-2026-001" },
    update: {},
    create: {
      qcNumber: "DEMO-QC-2026-001",
      grnId: grn.id,
      grnLineId: grnLine.id,
      sampleSize: "5",
      inspectedQuantity: "5",
      acceptedQuantity: "5",
      rejectedQuantity: "0",
      result: "PASS",
      remarks: `${DEMO} Dimensions and electrical resistance within specification.`,
      inspectedById: admin.id,
      inspectedAt: daysFromNow(-1),
    },
  });
  await ensure(
    db.qualityCheckParameter,
    { qualityCheckId: qualityCheck.id, parameterName: "No-load current" },
    {
      specification: "Maximum 2.5 A",
      minValue: "0",
      maxValue: "2.5",
      observedValue: "2.1 A",
      isPassed: true,
    }
  );
  await ensure(
    db.qualityCheckParameter,
    { qualityCheckId: qualityCheck.id, parameterName: "Shaft runout" },
    {
      specification: "Maximum 0.05 mm",
      minValue: "0",
      maxValue: "0.05",
      observedValue: "0.03 mm",
      isPassed: true,
    }
  );

  const putawayCompleted = await db.putawayTask.upsert({
    where: { taskNumber: "DEMO-PUT-2026-001" },
    update: {},
    create: {
      taskNumber: "DEMO-PUT-2026-001",
      warehouseId: warehouse.id,
      productId: products["DEMO-CMP-MOTOR"].id,
      lotId: motorLot.id,
      fromBinId: bins["RCV-01"].id,
      toBinId: bins["STO-A-01"].id,
      quantity: "20",
      movedQuantity: "20",
      status: "COMPLETED",
      priority: 3,
      grnLineId: grnLine.id,
      assignedToId: sales.id,
      completedById: sales.id,
      completedAt: daysFromNow(-1),
      notes: `${DEMO} Receipt moved to bulk storage.`,
    },
  });
  await db.putawayTask.upsert({
    where: { taskNumber: "DEMO-PUT-2026-002" },
    update: {},
    create: {
      taskNumber: "DEMO-PUT-2026-002",
      warehouseId: warehouse.id,
      productId: products["DEMO-FG-DRILL-20V"].id,
      lotId: finishedLot.id,
      fromBinId: bins["PRD-01"].id,
      toBinId: bins["PCK-A-01"].id,
      quantity: "8",
      movedQuantity: "0",
      status: "ASSIGNED",
      priority: 2,
      assignedToId: sales.id,
      notes: `${DEMO} Finished goods awaiting putaway.`,
    },
  });

  const bom = await db.billOfMaterials.upsert({
    where: { bomNumber: "DEMO-BOM-DRILL-001" },
    update: { status: "ACTIVE", isDefault: true },
    create: {
      bomNumber: "DEMO-BOM-DRILL-001",
      productId: products["DEMO-FG-DRILL-20V"].id,
      name: "Demo 20V Professional Drill Kit BOM",
      version: 1,
      revision: "A",
      status: "ACTIVE",
      isDefault: true,
      outputQuantity: "1",
      uomId: ea.id,
      effectiveFrom: daysFromNow(-60),
      rolledUpCost: "2385",
      costedAt: daysFromNow(-5),
      laborCost: "450",
      overheadCost: "300",
      notes: `${DEMO} Approved production structure.`,
      createdById: admin.id,
      approvedById: admin.id,
      approvedAt: daysFromNow(-30),
    },
  });
  const motorComponent = await db.bomComponent.upsert({
    where: {
      bomId_componentProductId: {
        bomId: bom.id,
        componentProductId: products["DEMO-CMP-MOTOR"].id,
      },
    },
    update: { quantity: "1" },
    create: {
      bomId: bom.id,
      componentProductId: products["DEMO-CMP-MOTOR"].id,
      lineNumber: 10,
      quantity: "1",
      uomId: ea.id,
      scrapPercent: "0.5",
      operationSequence: 10,
      referenceDesignator: "MOTOR-01",
    },
  });
  await db.bomComponent.upsert({
    where: {
      bomId_componentProductId: {
        bomId: bom.id,
        componentProductId: products["DEMO-RM-STEEL"].id,
      },
    },
    update: { quantity: "1.25" },
    create: {
      bomId: bom.id,
      componentProductId: products["DEMO-RM-STEEL"].id,
      lineNumber: 20,
      quantity: "1.25",
      uomId: kg.id,
      scrapPercent: "2",
      operationSequence: 20,
      referenceDesignator: "HOUSING-MATERIAL",
    },
  });
  await db.bomComponent.upsert({
    where: {
      bomId_componentProductId: {
        bomId: bom.id,
        componentProductId: products["DEMO-PKG-CASE"].id,
      },
    },
    update: { quantity: "1" },
    create: {
      bomId: bom.id,
      componentProductId: products["DEMO-PKG-CASE"].id,
      lineNumber: 30,
      quantity: "1",
      uomId: ea.id,
      operationSequence: 30,
      referenceDesignator: "CASE-01",
    },
  });
  await db.bomComponentSubstitute.upsert({
    where: {
      bomComponentId_substituteProductId: {
        bomComponentId: motorComponent.id,
        substituteProductId: products["DEMO-CMP-MOTOR-ALT"].id,
      },
    },
    update: { isActive: true },
    create: {
      bomComponentId: motorComponent.id,
      substituteProductId: products["DEMO-CMP-MOTOR-ALT"].id,
      priority: 1,
      conversionFactor: "1",
      isActive: true,
      notes: `${DEMO} Engineering-approved alternate motor.`,
    },
  });
  await ensure(
    db.bomChangeLog,
    { bomId: bom.id, changeType: "CREATED" },
    {
      description: `${DEMO} Initial BOM released for production.`,
      reason: "Demo production readiness",
      changedById: admin.id,
      createdAt: daysFromNow(-30),
    }
  );

  const productionOrder = await db.productionOrder.upsert({
    where: { orderNumber: "DEMO-PRO-2026-001" },
    update: {},
    create: {
      orderNumber: "DEMO-PRO-2026-001",
      productId: products["DEMO-FG-DRILL-20V"].id,
      bomId: bom.id,
      warehouseId: warehouse.id,
      status: "IN_PROGRESS",
      plannedQuantity: "20",
      producedQuantity: "10",
      scrappedQuantity: "0",
      plannedStartDate: daysFromNow(-4),
      plannedEndDate: daysFromNow(3),
      actualStartDate: daysFromNow(-3),
      plannedMaterialCost: "47700",
      actualMaterialCost: "19420",
      notes: `${DEMO} Active production run.`,
      createdById: admin.id,
    },
  });
  for (const component of [
    [products["DEMO-CMP-MOTOR"], "20", "10", "10", "0", "0.5", "1850"],
    [products["DEMO-RM-STEEL"], "25.5", "12", "10", "0.2", "2", "92"],
    [products["DEMO-PKG-CASE"], "20", "10", "10", "0", "0", "420"],
  ] as const) {
    await db.productionOrderComponent.upsert({
      where: {
        productionOrderId_productId: {
          productionOrderId: productionOrder.id,
          productId: component[0].id,
        },
      },
      update: {},
      create: {
        productionOrderId: productionOrder.id,
        productId: component[0].id,
        requiredQuantity: component[1],
        issuedQuantity: component[2],
        consumedQuantity: component[3],
        wastedQuantity: component[4],
        scrapPercent: component[5],
        standardUnitCost: component[6],
      },
    });
  }
  await ensure(
    db.productionOrderConsumption,
    {
      productionOrderId: productionOrder.id,
      lotId: steelLot.id,
      consumptionType: "CONSUMED",
    },
    {
      quantity: "10",
      unitCost: "92",
      totalCost: "920",
      reasonCode: "STANDARD_ISSUE",
      occurredAt: daysFromNow(-2),
    }
  );
  await ensure(
    db.productionOrderConsumption,
    {
      productionOrderId: productionOrder.id,
      lotId: steelLot.id,
      consumptionType: "WASTED",
    },
    {
      quantity: "0.2",
      unitCost: "92",
      totalCost: "18.4",
      reasonCode: "CUTTING_LOSS",
      occurredAt: daysFromNow(-2),
    }
  );

  const materialRequisition = await db.materialRequisition.upsert({
    where: { requisitionNumber: "DEMO-MR-2026-001" },
    update: {},
    create: {
      requisitionNumber: "DEMO-MR-2026-001",
      warehouseId: warehouse.id,
      productionOrderId: productionOrder.id,
      status: "PARTIALLY_ISSUED",
      requiredByDate: daysFromNow(-3),
      purpose: "Production issue for DEMO-PRO-2026-001",
      notes: `${DEMO} Remaining components will be issued next shift.`,
      requestedById: admin.id,
      issuedById: sales.id,
      issuedAt: daysFromNow(-2),
    },
  });
  for (const [product, requested, issued, uom] of [
    [products["DEMO-CMP-MOTOR"], "20", "10", ea],
    [products["DEMO-RM-STEEL"], "25.5", "12", kg],
    [products["DEMO-PKG-CASE"], "20", "10", ea],
  ] as const) {
    await ensure(
      db.materialRequisitionLine,
      { requisitionId: materialRequisition.id, productId: product.id },
      {
        requestedQuantity: requested,
        issuedQuantity: issued,
        uomId: uom.id,
        notes: `${DEMO} Production component issue.`,
      }
    );
  }

  const pickList = await db.pickList.upsert({
    where: { pickListNumber: "DEMO-PCK-2026-001" },
    update: {},
    create: {
      pickListNumber: "DEMO-PCK-2026-001",
      warehouseId: warehouse.id,
      status: "IN_PROGRESS",
      strategy: "FIFO",
      referenceType: "SALES_ORDER",
      referenceId: salesData.salesOrder.id,
      referenceNumber: salesData.salesOrder.orderNumber,
      assignedToId: sales.id,
      releasedById: admin.id,
      releasedAt: now,
      notes: `${DEMO} Partial pick for customer order.`,
    },
  });
  const pickTask = await ensure(
    db.pickTask,
    {
      pickListId: pickList.id,
      productId: products["DEMO-FG-DRILL-20V"].id,
      lotId: finishedLot.id,
    },
    {
      binId: bins["PCK-A-01"].id,
      sequence: 1,
      requestedQuantity: "5",
      pickedQuantity: "3",
      shortQuantity: "0",
      status: "IN_PROGRESS",
      pickedById: sales.id,
      notes: `${DEMO} Three of five units picked.`,
    }
  );
  const packageRecord = await db.package.upsert({
    where: { packageNumber: "DEMO-PKG-2026-001" },
    update: {},
    create: {
      packageNumber: "DEMO-PKG-2026-001",
      pickListId: pickList.id,
      palletId: pallet.id,
      status: "PACKED",
      grossWeightKg: "18.6",
      lengthCm: "62",
      widthCm: "42",
      heightCm: "38",
      trackingNumber: "DEMO-TRACK-001",
      carrier: "Demo Logistics",
      packedById: sales.id,
      packedAt: now,
    },
  });
  await ensure(
    db.packageLine,
    { packageId: packageRecord.id, pickTaskId: pickTask.id },
    {
      productId: products["DEMO-FG-DRILL-20V"].id,
      lotId: finishedLot.id,
      quantity: "3",
    }
  );

  await ensure(
    db.approvalProcess,
    { targetObjectName: "PURCHASE_ORDER", targetRecordId: purchaseOrder.id },
    {
      status: "APPROVED",
      comment: `${DEMO} Replenishment order approved.`,
      requestedToId: admin.id,
      lastActorId: admin.id,
      createdById: sales.id,
      completedDate: daysFromNow(-7),
    }
  );
  await ensure(
    db.approvalProcess,
    {
      targetObjectName: "PURCHASE_REQUISITION",
      targetRecordId: requisition.id,
    },
    {
      status: "APPROVED",
      comment: `${DEMO} Reorder request approved.`,
      requestedToId: admin.id,
      lastActorId: admin.id,
      createdById: sales.id,
      completedDate: daysFromNow(-7),
    }
  );
  await ensure(
    db.approvalProcess,
    { targetObjectName: "BOM", targetRecordId: bom.id },
    {
      status: "APPROVED",
      comment: `${DEMO} Engineering BOM approved for release.`,
      requestedToId: admin.id,
      lastActorId: admin.id,
      createdById: admin.id,
      completedDate: daysFromNow(-30),
    }
  );
  await ensure(
    db.notification,
    {
      userId: admin.id,
      title: "Demo material shortage",
      link: "/materials/shortages",
    },
    {
      type: "MATERIAL_SHORTAGE",
      message: "Demo Carry Case is below safety stock.",
      isRead: false,
    }
  );
  await ensure(
    db.notification,
    {
      userId: sales.id,
      title: "Demo goods receipt completed",
      link: `/purchasing/goods-receipts/${grn.id}`,
    },
    {
      type: "GOODS_RECEIVED",
      message: "DEMO-GRN-2026-001 was received and passed quality inspection.",
      isRead: false,
    }
  );
  await ensure(
    db.auditLog,
    {
      entityType: "ProductionOrder",
      entityId: productionOrder.id,
      action: "DEMO_RELEASED",
    },
    {
      changedBy: admin.id,
      category: "PRODUCTION",
      subCategory: "ORDER_RELEASE",
      newValues: { status: "IN_PROGRESS", demo: true },
    }
  );

  return {
    grn,
    qualityCheck,
    putawayCompleted,
    bom,
    productionOrder,
    materialRequisition,
    pickList,
    packageRecord,
  };
}

async function seedSettings(adminId: number) {
  const settings = [
    {
      key: "demo.workspace.notice",
      value: "Demo records use the DEMO prefix",
      description: "Identifies the non-production dataset across modules",
    },
    {
      key: "defaultCurrency",
      value: "INR",
      description: "Default workspace currency",
    },
  ];
  for (const setting of settings) {
    await db.globalSetting.upsert({
      where: { key: setting.key },
      update: setting,
      create: setting,
    });
  }
  await db.appConfig.upsert({
    where: { key: "demo.data.version" },
    update: { plainValue: "1", updatedByUserId: String(adminId) },
    create: {
      key: "demo.data.version",
      plainValue: "1",
      updatedByUserId: String(adminId),
    },
  });
  for (const config of [
    {
      key: "email.baseUrl",
      plainValue: "https://api.brevo.com/v3",
    },
    {
      key: "whatsapp.baseUrl",
      plainValue: "https://api.msg91.com/api/v5",
    },
  ]) {
    await db.appConfig.upsert({
      where: { key: config.key },
      update: {
        plainValue: config.plainValue,
        updatedByUserId: String(adminId),
      },
      create: { ...config, updatedByUserId: String(adminId) },
    });
  }
}

async function printCoverage() {
  const models = [
    "user",
    "account",
    "contact",
    "lead",
    "landingPageCampaign",
    "enquiry",
    "campaign",
    "campaignMember",
    "campaignChannel",
    "segment",
    "segmentRule",
    "whatsAppNumber",
    "whatsAppTemplate",
    "whatsAppCampaignConfig",
    "campaignDelivery",
    "webhookEvent",
    "optOut",
    "analyticsEvent",
    "botSession",
    "chatHistory",
    "knowledgeBase",
    "customField",
    "auditLog",
    "leadAssignmentRule",
    "formSubmission",
    "leadRemark",
    "subdealer",
    "invoice",
    "order",
    "appConfig",
    "product",
    "productCategory",
    "productOption",
    "productLineItem",
    "priceBook",
    "priceBookEntry",
    "currency",
    "keyword",
    "leadKeyword",
    "contactKeyword",
    "accountKeyword",
    "globalSetting",
    "opportunity",
    "opportunityLineItem",
    "opportunityActivity",
    "quote",
    "quoteLineItem",
    "salesOrder",
    "salesOrderLineItem",
    "approvalProcess",
    "notification",
    "numberSequence",
    "unitOfMeasure",
    "warehouse",
    "warehouseImage",
    "warehouseZone",
    "storageBin",
    "pallet",
    "stockLot",
    "stockBalance",
    "stockMovement",
    "stockReservation",
    "reorderRule",
    "stockAlert",
    "stockCount",
    "stockCountLine",
    "putawayTask",
    "pickList",
    "pickTask",
    "package",
    "packageLine",
    "billOfMaterials",
    "bomComponent",
    "bomComponentSubstitute",
    "bomChangeLog",
    "supplier",
    "supplierContact",
    "supplierProduct",
    "supplierPriceTier",
    "supplierPerformance",
    "purchaseRequisition",
    "purchaseRequisitionLine",
    "purchaseOrder",
    "purchaseOrderLine",
    "goodsReceiptNote",
    "goodsReceiptLine",
    "qualityCheck",
    "qualityCheckParameter",
    "materialRequisition",
    "materialRequisitionLine",
    "productionOrder",
    "productionOrderComponent",
    "productionOrderConsumption",
  ];
  const counts: Record<string, number> = {};
  for (const model of models) counts[model] = await db[model].count();
  console.table(counts);
  const emptyModels = Object.entries(counts)
    .filter(([, count]) => count === 0)
    .map(([model]) => model);
  if (emptyModels.length > 0) {
    throw new Error(
      `Demo coverage is incomplete for: ${emptyModels.join(", ")}`
    );
  }
}

async function main() {
  console.log(
    "🌱 Seeding non-destructive demo data for all application sections..."
  );
  await seedSupplyChainReference(prisma);
  const context = await seedUsersAndCrm();
  const catalog = await seedCatalog();
  await seedCampaigns(context);
  const salesData = await seedSales(context, catalog);
  await seedChatbotAndDealer(context, catalog);
  const supply = await seedSupplyChain(context, catalog, salesData);
  await seedOperationalDocuments(context, catalog, salesData, supply);
  await seedSettings(context.admin.id);
  await printCoverage();
  console.log(
    "✅ Real demo records are present across every user-facing module."
  );
  console.log("   Demo login: demo.admin@ralliwolf.example / admin123");
  console.log("   Sales login: demo.sales@ralliwolf.example / admin123");
}

main()
  .catch(error => {
    console.error("❌ Failed to seed all application sections:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
