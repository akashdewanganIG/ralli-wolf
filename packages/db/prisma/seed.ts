import {
  LeadStatus,
  PrismaClient,
  UserRole,
  LeadSource,
  Region,
  Contact as ContactModel,
  OpportunityStage,
  OpportunityType,
  OpportunityStatus,
  QuoteStatus,
  QuoteType,
  SalesOrderStatus,
} from "@prisma/client";
import {
  resetSupplyChainData,
  seedSupplyChainReference,
} from "./seed-supply-chain.js";

// Use DIRECT_URL for seeding to avoid PgBouncer prepared statement issues
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

// -------------------------------
// Helpers
// -------------------------------
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function randomDateWithin(days: number): Date {
  const now = new Date();
  const past = new Date(now);
  past.setDate(now.getDate() - randInt(0, days));
  past.setHours(randInt(0, 23), randInt(0, 59), randInt(0, 59), 0);
  return past;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildEmail(name: string, company: string): string {
  const n = slugify(name).replace(/-/g, ".");
  const c = slugify(company).replace(/-/g, "");
  return `${n}@${c}.com`;
}

async function main() {
  console.log("🌱 Seeding database (destructive reset, medium volume)...");

  // Destructive reset in FK-safe order (sequential to avoid prepared statement conflicts with connection poolers)
  // Supply-chain tables first: they reference products and users, so clearing
  // those below would otherwise fail on a foreign key.
  await resetSupplyChainData(prisma);

  // Approvals reference users and must go before the user wipe.
  await prisma.approvalProcess.deleteMany({});

  // Opportunity-Quote-Order tables (delete in reverse dependency order)
  await prisma.salesOrderLineItem.deleteMany({});
  await prisma.salesOrder.deleteMany({});
  await prisma.quoteLineItem.deleteMany({});
  await prisma.quote.deleteMany({});
  await prisma.opportunityActivity.deleteMany({});
  await prisma.opportunityLineItem.deleteMany({});
  await prisma.opportunity.deleteMany({});

  await prisma.chatHistory.deleteMany({});
  await prisma.botSession.deleteMany({});
  await prisma.analyticsEvent.deleteMany({});
  await prisma.formSubmission.deleteMany({});
  await prisma.campaignMember.deleteMany({});
  await prisma.campaignChannel.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.leadAssignmentRule.deleteMany({});
  await prisma.customField.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.segmentRule.deleteMany({});
  await prisma.segment.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.contact.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});

  // Currencies
  console.log("\n💰 Creating currencies...\n");
  // Kept in step with the 20260824120000_add_world_currencies migration, so a
  // freshly seeded database and a freshly migrated one offer the same list.
  const currencies = [
    { code: "USD", name: "US Dollar", symbol: "$", country: "United States" },
    { code: "EUR", name: "Euro", symbol: "€", country: "European Union" },
    { code: "JPY", name: "Japanese Yen", symbol: "¥", country: "Japan" },
    { code: "GBP", name: "British Pound", symbol: "£", country: "United Kingdom" },
    { code: "AUD", name: "Australian Dollar", symbol: "$", country: "Australia" },
    { code: "CAD", name: "Canadian Dollar", symbol: "$", country: "Canada" },
    { code: "CHF", name: "Swiss Franc", symbol: "CHF", country: "Switzerland" },
    { code: "CNY", name: "Chinese Yuan", symbol: "¥", country: "China" },
    { code: "INR", name: "Indian Rupee", symbol: "₹", country: "India" },
    { code: "NZD", name: "New Zealand Dollar", symbol: "$", country: "New Zealand" },
    { code: "SGD", name: "Singapore Dollar", symbol: "$", country: "Singapore" },
    { code: "HKD", name: "Hong Kong Dollar", symbol: "$", country: "Hong Kong" },
    { code: "SEK", name: "Swedish Krona", symbol: "kr", country: "Sweden" },
    { code: "NOK", name: "Norwegian Krone", symbol: "kr", country: "Norway" },
    { code: "DKK", name: "Danish Krone", symbol: "kr", country: "Denmark" },
    { code: "ISK", name: "Icelandic Krona", symbol: "kr", country: "Iceland" },
    { code: "KRW", name: "South Korean Won", symbol: "₩", country: "South Korea" },
    { code: "TWD", name: "New Taiwan Dollar", symbol: "NT$", country: "Taiwan" },
    { code: "MXN", name: "Mexican Peso", symbol: "$", country: "Mexico" },
    { code: "BRL", name: "Brazilian Real", symbol: "R$", country: "Brazil" },
    { code: "ZAR", name: "South African Rand", symbol: "R", country: "South Africa" },
    { code: "RUB", name: "Russian Ruble", symbol: "₽", country: "Russia" },
    { code: "TRY", name: "Turkish Lira", symbol: "₺", country: "Turkey" },
    { code: "PLN", name: "Polish Zloty", symbol: "zł", country: "Poland" },
    { code: "CZK", name: "Czech Koruna", symbol: "Kč", country: "Czechia" },
    { code: "HUF", name: "Hungarian Forint", symbol: "Ft", country: "Hungary" },
    { code: "RON", name: "Romanian Leu", symbol: "lei", country: "Romania" },
    { code: "BGN", name: "Bulgarian Lev", symbol: "лв", country: "Bulgaria" },
    { code: "UAH", name: "Ukrainian Hryvnia", symbol: "₴", country: "Ukraine" },
    { code: "RSD", name: "Serbian Dinar", symbol: "дин", country: "Serbia" },
    { code: "AED", name: "UAE Dirham", symbol: "د.إ", country: "United Arab Emirates" },
    { code: "SAR", name: "Saudi Riyal", symbol: "﷼", country: "Saudi Arabia" },
    { code: "QAR", name: "Qatari Riyal", symbol: "﷼", country: "Qatar" },
    { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك", country: "Kuwait" },
    { code: "BHD", name: "Bahraini Dinar", symbol: "د.ب", country: "Bahrain" },
    { code: "OMR", name: "Omani Rial", symbol: "﷼", country: "Oman" },
    { code: "ILS", name: "Israeli New Shekel", symbol: "₪", country: "Israel" },
    { code: "JOD", name: "Jordanian Dinar", symbol: "د.ا", country: "Jordan" },
    { code: "LBP", name: "Lebanese Pound", symbol: "ل.ل", country: "Lebanon" },
    { code: "IQD", name: "Iraqi Dinar", symbol: "ع.د", country: "Iraq" },
    { code: "IRR", name: "Iranian Rial", symbol: "﷼", country: "Iran" },
    { code: "YER", name: "Yemeni Rial", symbol: "﷼", country: "Yemen" },
    { code: "THB", name: "Thai Baht", symbol: "฿", country: "Thailand" },
    { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", country: "Malaysia" },
    { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", country: "Indonesia" },
    { code: "PHP", name: "Philippine Peso", symbol: "₱", country: "Philippines" },
    { code: "VND", name: "Vietnamese Dong", symbol: "₫", country: "Vietnam" },
    { code: "BND", name: "Brunei Dollar", symbol: "$", country: "Brunei" },
    { code: "KHR", name: "Cambodian Riel", symbol: "៛", country: "Cambodia" },
    { code: "LAK", name: "Lao Kip", symbol: "₭", country: "Laos" },
    { code: "MMK", name: "Myanmar Kyat", symbol: "K", country: "Myanmar" },
    { code: "MNT", name: "Mongolian Tugrik", symbol: "₮", country: "Mongolia" },
    { code: "MOP", name: "Macanese Pataca", symbol: "MOP$", country: "Macao" },
    { code: "FJD", name: "Fijian Dollar", symbol: "$", country: "Fiji" },
    { code: "PGK", name: "Papua New Guinean Kina", symbol: "K", country: "Papua New Guinea" },
    { code: "PKR", name: "Pakistani Rupee", symbol: "₨", country: "Pakistan" },
    { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", country: "Bangladesh" },
    { code: "LKR", name: "Sri Lankan Rupee", symbol: "₨", country: "Sri Lanka" },
    { code: "NPR", name: "Nepalese Rupee", symbol: "₨", country: "Nepal" },
    { code: "MVR", name: "Maldivian Rufiyaa", symbol: "Rf", country: "Maldives" },
    { code: "AFN", name: "Afghan Afghani", symbol: "؋", country: "Afghanistan" },
    { code: "BTN", name: "Bhutanese Ngultrum", symbol: "Nu.", country: "Bhutan" },
    { code: "KZT", name: "Kazakhstani Tenge", symbol: "₸", country: "Kazakhstan" },
    { code: "UZS", name: "Uzbekistani Som", symbol: "so'm", country: "Uzbekistan" },
    { code: "AZN", name: "Azerbaijani Manat", symbol: "₼", country: "Azerbaijan" },
    { code: "GEL", name: "Georgian Lari", symbol: "₾", country: "Georgia" },
    { code: "AMD", name: "Armenian Dram", symbol: "֏", country: "Armenia" },
    { code: "EGP", name: "Egyptian Pound", symbol: "£", country: "Egypt" },
    { code: "NGN", name: "Nigerian Naira", symbol: "₦", country: "Nigeria" },
    { code: "KES", name: "Kenyan Shilling", symbol: "KSh", country: "Kenya" },
    { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", country: "Tanzania" },
    { code: "UGX", name: "Ugandan Shilling", symbol: "USh", country: "Uganda" },
    { code: "GHS", name: "Ghanaian Cedi", symbol: "₵", country: "Ghana" },
    { code: "ETB", name: "Ethiopian Birr", symbol: "Br", country: "Ethiopia" },
    { code: "MAD", name: "Moroccan Dirham", symbol: "د.م.", country: "Morocco" },
    { code: "DZD", name: "Algerian Dinar", symbol: "د.ج", country: "Algeria" },
    { code: "TND", name: "Tunisian Dinar", symbol: "د.ت", country: "Tunisia" },
    { code: "MUR", name: "Mauritian Rupee", symbol: "₨", country: "Mauritius" },
    { code: "BWP", name: "Botswana Pula", symbol: "P", country: "Botswana" },
    { code: "NAD", name: "Namibian Dollar", symbol: "$", country: "Namibia" },
    { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK", country: "Zambia" },
    { code: "MZN", name: "Mozambican Metical", symbol: "MT", country: "Mozambique" },
    { code: "AOA", name: "Angolan Kwanza", symbol: "Kz", country: "Angola" },
    { code: "XOF", name: "West African CFA Franc", symbol: "CFA", country: "West African Union" },
    { code: "XAF", name: "Central African CFA Franc", symbol: "FCFA", country: "Central African Union" },
    { code: "ARS", name: "Argentine Peso", symbol: "$", country: "Argentina" },
    { code: "CLP", name: "Chilean Peso", symbol: "$", country: "Chile" },
    { code: "COP", name: "Colombian Peso", symbol: "$", country: "Colombia" },
    { code: "PEN", name: "Peruvian Sol", symbol: "S/", country: "Peru" },
    { code: "UYU", name: "Uruguayan Peso", symbol: "$U", country: "Uruguay" },
    { code: "BOB", name: "Bolivian Boliviano", symbol: "Bs.", country: "Bolivia" },
    { code: "PYG", name: "Paraguayan Guarani", symbol: "₲", country: "Paraguay" },
    { code: "CRC", name: "Costa Rican Colon", symbol: "₡", country: "Costa Rica" },
    { code: "GTQ", name: "Guatemalan Quetzal", symbol: "Q", country: "Guatemala" },
    { code: "DOP", name: "Dominican Peso", symbol: "RD$", country: "Dominican Republic" },
    { code: "JMD", name: "Jamaican Dollar", symbol: "$", country: "Jamaica" },
    { code: "TTD", name: "Trinidad and Tobago Dollar", symbol: "$", country: "Trinidad and Tobago" },
  ];
  await prisma.currency.createMany({
    data: currencies,
    skipDuplicates: true,
  });

  // add default currency in global settings
  await prisma.globalSetting.upsert({
    where: { key: "defaultCurrency" },
    update: { value: "INR" },
    create: { key: "defaultCurrency", value: "INR" },
  });

  // add default opportunity discount threshold (0 = any discount requires approval)
  await prisma.globalSetting.upsert({
    where: { key: "OPPORTUNITY_DISCOUNT_THRESHOLD" },
    update: {},
    create: {
      key: "OPPORTUNITY_DISCOUNT_THRESHOLD",
      value: "0",
      description:
        "Maximum discount % on line items allowed without manager approval",
    },
  });

  // Supply-chain reference data: units of measure, document numbering and
  // alert-engine settings. Idempotent, so it is also safe to run on its own
  // against an existing environment via `npm run db:seed:supply-chain`.
  console.log("\n📦 Seeding supply chain reference data...\n");
  await seedSupplyChainReference(prisma);

  // Users with roles
  const passwordHash =
    "$2a$10$zkwJCafrQjcLn2.Z1bJA.OKYuQ/RVFL6w2pKEFWY5387H/ET4zmOu"; // "admin123"

  console.log("\n🔐 Creating user accounts...\n");

  // 1. ADMIN User
  const superAdminUser = await prisma.user.upsert({
    where: { email: "superadmin@example.com" },
    update: {},
    create: {
      firstName: "Super",
      lastName: "Admin",
      email: "superadmin@example.com",
      passwordHash,
      role: UserRole.ADMIN,
      region: null, // System admins don't need regions
      countryCode: "91",
    },
  });

  // 2. ADMIN User
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
      passwordHash,
      role: UserRole.ADMIN,
      region: Region.NORTH,
      countryCode: "91",
    },
  });

  // 3. DEVELOPER User (matches .env credentials)
  // Note: Email and password should match your .env file for developer login
  const developerUser = await prisma.user.upsert({
    where: { email: "developer@example.com" },
    update: {},
    create: {
      firstName: "Developer",
      lastName: "Access",
      email: "developer@example.com",
      passwordHash, // "admin123" - but you should use DEVELOPER_LOGIN_PASSWORD from .env
      role: UserRole.ADMIN,
      region: null,
      countryCode: "91",
    },
  });

  const salesUserProfiles = [
    {
      firstName: "Sarah",
      lastName: "Sales",
      email: "sarah.sales@example.com",
      region: Region.SOUTH,
    },
    {
      firstName: "Liam",
      lastName: "Prospect",
      email: "liam.sales@example.com",
      region: Region.NORTH,
    },
    {
      firstName: "Priya",
      lastName: "Closer",
      email: "priya.sales@example.com",
      region: Region.WEST_1,
    },
    {
      firstName: "Diego",
      lastName: "Hunter",
      email: "diego.sales@example.com",
      region: Region.WEST_2,
    },
  ];
  const salesUsers = await Promise.all(
    salesUserProfiles.map(profile =>
      prisma.user.upsert({
        where: { email: profile.email },
        update: {},
        create: {
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          passwordHash,
          role: UserRole.SALES,
          region: profile.region,
          countryCode: "91",
        },
      })
    )
  );
  const primarySalesUser = salesUsers[0];

  const marketingUser = await prisma.user.upsert({
    where: { email: "mike.marketing@example.com" },
    update: {},
    create: {
      firstName: "Mike",
      lastName: "Marketing",
      email: "mike.marketing@example.com",
      passwordHash,
      role: UserRole.ADMIN,
      region: Region.EAST,
      countryCode: "91",
    },
  });

  // Accounts
  const industries = [
    "Technology",
    "Marketing",
    "Consulting",
    "E-commerce",
    "Healthcare",
    "Education",
    "Finance",
    "Manufacturing",
  ];
  const companyNames = [
    "TechNova Labs",
    "MarketGenius",
    "BluePeak Consulting",
    "Orbit Retail",
    "HealthSync",
    "EduSphere",
    "FinEdge Capital",
    "ForgeWorks",
    "BrightPath",
    "CloudBridge",
    "VectorAI",
    "LuminaSoft",
    "GrowthFoundry",
    "PinnacleOps",
    "ApexMetrics",
    "SummitHub",
    "NeonByte",
    "QuantumWare",
    "AtlasGroup",
    "Zenith Systems",
  ];
  const accountCache = new Map<string, { id: number; name: string }>();
  async function getOrCreateAccount(name: string) {
    if (accountCache.has(name)) {
      return accountCache.get(name)!;
    }
    const created = await prisma.account.create({
      data: {
        name,
        industry: pick(industries),
        website: `https://www.${slugify(name)}.com`,
      },
    });
    const accountRecord = { id: created.id, name: created.name };
    accountCache.set(name, accountRecord);
    return accountRecord;
  }
  const contacts: {
    id: number;
    name: string;
    email: string;
    accountId?: number | null;
  }[] = [];
  const firstNames = [
    "John",
    "Sarah",
    "Mike",
    "Emily",
    "David",
    "Laura",
    "Adam",
    "Nina",
    "Chris",
    "Olivia",
    "Ethan",
    "Grace",
    "Liam",
    "Sophia",
    "Noah",
    "Ava",
  ];
  const lastNames = [
    "Smith",
    "Johnson",
    "Davis",
    "Brown",
    "Wilson",
    "Clark",
    "Lopez",
    "Taylor",
    "Lee",
    "Martin",
    "Walker",
    "Hall",
    "Young",
    "King",
  ];
  const positions = [
    "CTO",
    "CMO",
    "Marketing Director",
    "VP Sales",
    "CEO",
    "Growth Lead",
    "Head of Ops",
    "Product Manager",
  ];

  // Campaigns
  const landingCampaign = await prisma.campaign.create({
    data: {
      name: "Spring Landing Page Lead Gen",
      description: "Landing page campaign to capture demo requests",
      startDate: randomDateWithin(90),
      endDate: null,
      createdBy: marketingUser.id,
    },
  });
  await prisma.campaignChannel.create({
    data: {
      campaignId: landingCampaign.id,
      channelType: "landing-page-campaign",
      externalId: `lp-${landingCampaign.id}-${Date.now()}`,
    },
  });

  const whatsappCampaign = await prisma.campaign.create({
    data: {
      name: "WhatsApp Re-Engagement",
      description: "Follow-up with dormant leads via WhatsApp",
      startDate: randomDateWithin(60),
      endDate: null,
      createdBy: marketingUser.id,
    },
  });
  await prisma.campaignChannel.create({
    data: {
      campaignId: whatsappCampaign.id,
      channelType: "whatsapp-campaign",
      externalId: `wa-${whatsappCampaign.id}-${Date.now()}`,
    },
  });

  const emailCampaign = await prisma.campaign.create({
    data: {
      name: "Email Nurture Series",
      description: "Three-touch email sequence for product education",
      startDate: randomDateWithin(75),
      endDate: null,
      createdBy: marketingUser.id,
    },
  });
  await prisma.campaignChannel.create({
    data: {
      campaignId: emailCampaign.id,
      channelType: "email-marketing",
      externalId: `em-${emailCampaign.id}-${Date.now()}`,
    },
  });

  // Leads
  const leadSources = ["IMPORT", "LANDING_PAGE", "MANUAL"];
  const leadStatuses = [
    "OPEN",
    "WORKING",
    "QUALIFIED",
    "NURTURING",
    "CONVERTED",
    "UNQUALIFIED",
  ];

  const leads = [] as { id: number; email: string }[];
  const totalLeads = 500;
  const assignedLeadCount = 400;
  const unassignedLeadCount = totalLeads - assignedLeadCount;
  const assignmentPlan = [
    ...Array(assignedLeadCount).fill(true),
    ...Array(unassignedLeadCount).fill(false),
  ].sort(() => Math.random() - 0.5);
  const usedLeadEmails = new Set<string>();

  // Location data for seed data (Indian context)
  const cities = [
    "Mumbai",
    "Delhi",
    "Bengaluru",
    "Hyderabad",
    "Chennai",
    "Pune",
    "Ahmedabad",
    "Kolkata",
    "Jaipur",
    "Chandigarh",
  ];
  const states = [
    "Maharashtra",
    "Delhi",
    "Karnataka",
    "Telangana",
    "Tamil Nadu",
    "Maharashtra",
    "Gujarat",
    "West Bengal",
    "Rajasthan",
    "Punjab",
  ];
  const pincodes = [
    "400001",
    "110001",
    "560001",
    "500001",
    "600001",
    "411001",
    "380001",
    "700001",
    "302001",
    "160017",
  ];

  const generateIndianPhoneNumber = () => {
    const prefixes = ["6", "7", "8", "9"];
    const firstDigit = pick(prefixes);
    let remaining = "";
    for (let i = 0; i < 9; i++) {
      remaining += randInt(0, 9);
    }
    return `${firstDigit}${remaining}`;
  };

  for (let i = 0; i < totalLeads; i++) {
    const isAssigned = assignmentPlan[i];
    const owner = isAssigned ? pick(salesUsers) : null;
    const firstName = pick(firstNames);
    const lastName = pick(lastNames);
    const fullName = `${firstName} ${lastName}`;
    const company = pick(companyNames);
    let email = buildEmail(fullName, company);

    // Ensure unique email by adding suffix if needed
    let counter = 1;
    while (usedLeadEmails.has(email)) {
      email = email.replace("@", `+${counter}@`);
      counter++;
    }
    usedLeadEmails.add(email);

    // Pick location indices (same index for matching data)
    const statusPool = owner
      ? leadStatuses
      : leadStatuses.filter(s => s !== "CONVERTED");
    const status = pick(statusPool) as LeadStatus;

    let convertedContactId: number | null = null;
    if (status === "CONVERTED") {
      const existingContact = await prisma.contact.findUnique({
        where: { email },
      });
      const account = await getOrCreateAccount(company);
      let contactRecord: ContactModel;
      if (existingContact) {
        contactRecord = existingContact;
      } else {
        contactRecord = await prisma.contact.create({
          data: {
            name: fullName,
            email,
            phone: generateIndianPhoneNumber(),
            countryCode: "91",
            position: pick(positions),
            accountId: account.id,
          },
        });
      }
      convertedContactId = contactRecord.id;
      if (!contacts.some(c => c.id === contactRecord.id)) {
        contacts.push({
          id: contactRecord.id,
          name: contactRecord.name,
          email: contactRecord.email,
          accountId: contactRecord.accountId,
        });
      }
    }

    const created = await prisma.lead.create({
      data: {
        firstName,
        lastName,
        email: email,
        phone: generateIndianPhoneNumber(),
        countryCode: "91",
        companyName: company,
        city: pick(cities),
        state: pick(states),
        pincode: pick(pincodes),
        source: pick(leadSources) as LeadSource,
        status,
        ownerId: owner ? owner.id : null,
        assignedAt: owner ? randomDateWithin(60) : null,
        convertedToContactId: convertedContactId,
        score: randInt(10, 100),
      },
    });
    leads.push({ id: created.id, email: created.email });
  }

  // Campaign Members (contacts + leads)
  const memberStatuses = ["Invited", "Clicked", "Responded"];
  const allCampaigns = [landingCampaign, whatsappCampaign, emailCampaign];

  for (const c of allCampaigns) {
    const sampleContacts = contacts.slice(0, randInt(15, 25));
    for (const ct of sampleContacts) {
      try {
        await prisma.campaignMember.create({
          data: {
            campaignId: c.id,
            contactId: ct.id,
            status: pick(memberStatuses),
          },
        });
      } catch {}
    }
    const sampleLeads = leads.slice(0, randInt(20, 35));
    for (const ld of sampleLeads) {
      try {
        await prisma.campaignMember.create({
          data: {
            campaignId: c.id,
            leadId: ld.id,
            status: pick(memberStatuses),
          },
        });
      } catch {}
    }
  }

  // Analytics Events by channel
  type MemberRef = { campaignId: number; contactId?: number; leadId?: number };
  const membersLanding = await prisma.campaignMember.findMany({
    where: { campaignId: landingCampaign.id },
  });
  const membersWhatsApp = await prisma.campaignMember.findMany({
    where: { campaignId: whatsappCampaign.id },
  });
  const membersEmail = await prisma.campaignMember.findMany({
    where: { campaignId: emailCampaign.id },
  });

  const makeEvent = (
    ref: MemberRef,
    eventType: string,
    eventData: Record<string, any> = {}
  ) => ({
    campaignId: ref.campaignId,
    contactId: ref.contactId ?? null,
    leadId: ref.leadId ?? null,
    eventType,
    eventData,
    occurredAt: randomDateWithin(90),
  });

  const analyticsToCreate: any[] = [];
  // Landing page events
  for (const m of membersLanding) {
    const ref = {
      campaignId: m.campaignId,
      contactId: m.contactId ?? undefined,
      leadId: m.leadId ?? undefined,
    };
    analyticsToCreate.push(
      makeEvent(ref, "page_view", { path: "/", utm_source: "google" })
    );
    if (Math.random() < 0.6)
      analyticsToCreate.push(
        makeEvent(ref, "form_submit", { form: "demo", success: true })
      );
  }
  // WhatsApp events
  for (const m of membersWhatsApp) {
    const ref = {
      campaignId: m.campaignId,
      contactId: m.contactId ?? undefined,
      leadId: m.leadId ?? undefined,
    };
    analyticsToCreate.push(
      makeEvent(ref, "whatsapp_msg_sent", { template: "reengage_v1" })
    );
    if (Math.random() < 0.45)
      analyticsToCreate.push(
        makeEvent(ref, "whatsapp_reply", {
          sentiment: pick(["positive", "neutral", "negative"]),
        })
      );
  }
  // Email events
  for (const m of membersEmail) {
    const ref = {
      campaignId: m.campaignId,
      contactId: m.contactId ?? undefined,
      leadId: m.leadId ?? undefined,
    };
    analyticsToCreate.push(
      makeEvent(ref, "email_sent", { messageId: `m-${m.id}` })
    );
    if (Math.random() < 0.7)
      analyticsToCreate.push(
        makeEvent(ref, "email_open", { userAgent: "Mozilla" })
      );
    if (Math.random() < 0.4)
      analyticsToCreate.push(
        makeEvent(ref, "email_click", { url: "/pricing" })
      );
  }

  // Batch create analytics in chunks to avoid large payloads
  const chunkSize = 100;
  for (let i = 0; i < analyticsToCreate.length; i += chunkSize) {
    const slice = analyticsToCreate.slice(i, i + chunkSize);
    await prisma.analyticsEvent.createMany({ data: slice });
  }

  // Form Submissions (landing page)
  const formSubsToCreate: any[] = [];
  const landingMembers = [...membersLanding];
  for (let i = 0; i < randInt(30, 50) && i < landingMembers.length; i++) {
    const m = landingMembers[i];
    const name = m.contactId
      ? (contacts.find(c => c.id === m.contactId)?.name ?? "")
      : (leads
          .find(l => l.id === (m.leadId as number))
          ?.email.split("@")[0]
          .replace(".", " ") ?? "");
    formSubsToCreate.push({
      leadId: m.leadId ?? null,
      contactId: m.contactId ?? null,
      submittedAt: randomDateWithin(90),
      formData: {
        name,
        email: m.contactId
          ? contacts.find(c => c.id === m.contactId)?.email
          : leads.find(l => l.id === (m.leadId as number))?.email,
        utm_campaign: "spring-lp",
      },
    });
  }
  for (let i = 0; i < formSubsToCreate.length; i += 100) {
    await prisma.formSubmission.createMany({
      data: formSubsToCreate.slice(i, i + 100),
    });
  }

  // WhatsApp Bot Sessions + Chat History
  const whatsappContacts = membersWhatsApp
    .filter(m => m.contactId)
    .slice(0, randInt(10, 20));
  for (const m of whatsappContacts) {
    const startedAt = randomDateWithin(45);
    const ended = Math.random() < 0.6;
    const session = await prisma.botSession.create({
      data: {
        contactId: m.contactId as number,
        userId: marketingUser.id,
        startedAt,
        endedAt: ended
          ? new Date(startedAt.getTime() + randInt(10, 3600) * 1000)
          : null,
        status: ended ? "closed" : "open",
      },
    });
    const msgs = [
      { sender: "system", message: "Hello! Can we help with your evaluation?" },
      {
        sender: "contact",
        message: pick(["Yes, tell me more", "Maybe later", "What's pricing?"]),
      },
      {
        sender: "system",
        message: pick([
          "We offer flexible plans.",
          "We have a free trial.",
          "I'll connect you with sales.",
        ]),
      },
    ];
    for (const msg of msgs) {
      await prisma.chatHistory.create({
        data: {
          contactId: m.contactId as number,
          sessionId: session.id,
          message: msg.message,
          sender: msg.sender,
          createdAt: new Date(startedAt.getTime() + randInt(1, 1800) * 1000),
        },
      });
    }
  }

  // Lead Assignment Rules
  await prisma.leadAssignmentRule.createMany({
    data: [
      {
        name: "High Score Website Leads",
        criteria: { score_gte: 85, source: "Website" },
        assignedUserId: primarySalesUser.id,
        priority: 1,
        active: true,
        createdAt: new Date(),
      },
      {
        name: "WhatsApp Quick Replies",
        criteria: { source: "WhatsApp" },
        assignedUserId: salesUsers[1]?.id ?? primarySalesUser.id,
        priority: 2,
        active: true,
        createdAt: new Date(),
      },
    ],
  });

  // 1. default pricebook entry
  const standardPriceBook = await prisma.priceBook.upsert({
    where: { id: 1 }, // Assuming ID 1 for standard price book
    update: { name: "Standard Price Book" },
    create: {
      id: 1, // Explicitly set ID for standard price book
      name: "Standard Price Book",
      currencyCode: "INR",
      description: "Standard prices for all products.",
      isActive: true,
    },
  });

  // ============================================
  // OPPORTUNITY-QUOTE-ORDER SEED DATA
  // ============================================
  console.log("\n💼 Creating Opportunities, Quotes, and Sales Orders...\n");

  // First, create product categories and products for line items
  const productCategory = await prisma.productCategory.upsert({
    where: { name: "Software Services" },
    update: {},
    create: {
      name: "Software Services",
      description: "Software products and services",
    },
  });

  const hardwareCategory = await prisma.productCategory.upsert({
    where: { name: "Hardware" },
    update: {},
    create: {
      name: "Hardware",
      description: "Hardware products",
    },
  });

  // Create products
  const productData = [
    {
      name: "Enterprise CRM License",
      code: "CRM-ENT-001",
      categoryId: productCategory.id,
      price: 50000,
      active: true,
    },
    {
      name: "CRM Pro License",
      code: "CRM-PRO-001",
      categoryId: productCategory.id,
      price: 25000,
      active: true,
    },
    {
      name: "CRM Basic License",
      code: "CRM-BAS-001",
      categoryId: productCategory.id,
      price: 10000,
      active: true,
    },
    {
      name: "Implementation Services",
      code: "SVC-IMP-001",
      categoryId: productCategory.id,
      price: 75000,
      active: true,
    },
    {
      name: "Training Package",
      code: "SVC-TRN-001",
      categoryId: productCategory.id,
      price: 15000,
      active: true,
    },
    {
      name: "Annual Support Contract",
      code: "SVC-SUP-001",
      categoryId: productCategory.id,
      price: 30000,
      active: true,
    },
    {
      name: "Custom Development (per day)",
      code: "SVC-DEV-001",
      categoryId: productCategory.id,
      price: 25000,
      active: true,
    },
    {
      name: "Server Hardware Bundle",
      code: "HW-SRV-001",
      categoryId: hardwareCategory.id,
      price: 150000,
      active: true,
    },
    {
      name: "Workstation Setup",
      code: "HW-WKS-001",
      categoryId: hardwareCategory.id,
      price: 45000,
      active: true,
    },
    {
      name: "Network Equipment Package",
      code: "HW-NET-001",
      categoryId: hardwareCategory.id,
      price: 80000,
      active: true,
    },
  ];

  const products: { id: number; name: string; code: string; price: number }[] =
    [];
  for (const p of productData) {
    const product = await prisma.product.upsert({
      where: { code: p.code },
      update: { active: p.active },
      create: {
        name: p.name,
        code: p.code,
        categoryId: p.categoryId,
        active: p.active,
        description: `${p.name} - Standard offering`,
      },
    });
    products.push({
      id: product.id,
      name: product.name,
      code: product.code,
      price: p.price,
    });
  }

  // Create price book entries for all products
  for (const p of products) {
    await prisma.priceBookEntry.upsert({
      where: {
        productId_priceBookId: {
          productId: p.id,
          priceBookId: standardPriceBook.id,
        },
      },
      update: { listPrice: p.price },
      create: {
        productId: p.id,
        priceBookId: standardPriceBook.id,
        listPrice: p.price,
        useStandardPrice: true,
        isActive: true,
      },
    });
  }

  // Get price book entries for creating line items
  const priceBookEntries = await prisma.priceBookEntry.findMany({
    where: { priceBookId: standardPriceBook.id },
    include: { product: true },
  });

  // Get accounts and contacts for opportunities (use existing ones)
  const allAccounts = await prisma.account.findMany({ take: 20 });
  const allContacts = await prisma.contact.findMany({
    where: { accountId: { not: null } },
    take: 50,
  });

  // Opportunity stages with probabilities
  const stageProbabilities: Record<OpportunityStage, number> = {
    [OpportunityStage.PROSPECT]: 10,
    [OpportunityStage.QUALIFICATION]: 20,
    [OpportunityStage.DISCOVERY]: 40,
    [OpportunityStage.VALUE_PROPOSITION]: 60,
    [OpportunityStage.PROPOSAL]: 75,
    [OpportunityStage.NEGOTIATION]: 90,
    [OpportunityStage.CLOSED_WON]: 100,
    [OpportunityStage.CLOSED_LOST]: 0,
  };

  const opportunityTypes = Object.values(OpportunityType);
  const opportunityStages = Object.values(OpportunityStage);

  // Generate opportunity number
  let oppCounter = 1;
  const generateOppNumber = () => {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    return `OPP-${yy}${mm}-${(oppCounter++).toString().padStart(4, "0")}`;
  };

  // Generate quote number with version
  let quoteCounter = 1;
  const generateQuoteNumber = (version: number = 1) => {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const versionLetter = String.fromCharCode(64 + version); // A, B, C...
    return `QUO-${yy}${mm}-${(quoteCounter++).toString().padStart(4, "0")}-${versionLetter}`;
  };

  // Generate order number
  let orderCounter = 1;
  const generateOrderNumber = () => {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    return `ORD-${yy}${mm}-${(orderCounter++).toString().padStart(4, "0")}`;
  };

  // Create opportunities with varying stages and statuses
  const opportunityNames = [
    "Enterprise CRM Implementation",
    "Digital Transformation Project",
    "Cloud Migration Initiative",
    "Sales Automation Suite",
    "Customer Portal Development",
    "Data Analytics Platform",
    "Marketing Automation Setup",
    "Service Desk Solution",
    "ERP Integration Project",
    "Mobile App Development",
    "Business Intelligence Dashboard",
    "Workflow Automation System",
    "Customer Success Platform",
    "Partner Portal Implementation",
    "E-commerce Integration",
  ];

  const createdOpportunities: {
    id: number;
    opportunityNumber: string;
    stage: OpportunityStage;
    status: OpportunityStatus;
    accountId: number;
    contactId: number | null;
    ownerId: number;
  }[] = [];

  console.log("  Creating 15 opportunities with line items...");

  for (let i = 0; i < 15; i++) {
    const account = allAccounts[i % allAccounts.length];
    const contact =
      allContacts.find(c => c.accountId === account.id) ||
      allContacts[i % allContacts.length];
    const owner = salesUsers[i % salesUsers.length];
    const stage = opportunityStages[Math.min(i % 8, 7)] as OpportunityStage;

    // Determine status based on stage
    let status: OpportunityStatus = OpportunityStatus.IN_PROGRESS;
    if (stage === OpportunityStage.PROSPECT) {
      status = OpportunityStatus.DRAFT;
    } else if (
      stage === OpportunityStage.CLOSED_WON ||
      stage === OpportunityStage.CLOSED_LOST
    ) {
      status = OpportunityStatus.QUOTE_CREATED;
    } else if (i % 3 === 0) {
      status = OpportunityStatus.QUOTE_CREATED;
    }

    const expectedClose = new Date();
    expectedClose.setDate(expectedClose.getDate() + randInt(30, 180));

    const opportunity = await prisma.opportunity.create({
      data: {
        opportunityNumber: generateOppNumber(),
        name: `${opportunityNames[i]} - ${account.name}`,
        description: `${opportunityNames[i]} opportunity for ${account.name}. This includes software licensing, implementation services, and ongoing support.`,
        stage,
        type: pick(opportunityTypes),
        status,
        amount: randInt(100000, 2000000),
        probability: stageProbabilities[stage],
        expectedCloseDate: expectedClose,
        actualCloseDate:
          stage === OpportunityStage.CLOSED_WON ||
          stage === OpportunityStage.CLOSED_LOST
            ? randomDateWithin(30)
            : null,
        leadSource: pick([
          "Website",
          "Referral",
          "Trade Show",
          "Cold Call",
          "Partner",
        ]),
        nextStep:
          stage === OpportunityStage.CLOSED_WON ||
          stage === OpportunityStage.CLOSED_LOST
            ? null
            : pick([
                "Schedule demo",
                "Send proposal",
                "Follow up call",
                "Technical review",
                "Contract negotiation",
              ]),
        lossReason:
          stage === OpportunityStage.CLOSED_LOST
            ? pick([
                "Budget constraints",
                "Chose competitor",
                "Project postponed",
                "No decision",
              ])
            : null,
        accountId: account.id,
        contactId: contact?.id || null,
        priceBookId: standardPriceBook.id,
        ownerId: owner.id,
        createdBy: owner.id,
      },
    });

    createdOpportunities.push({
      id: opportunity.id,
      opportunityNumber: opportunity.opportunityNumber,
      stage: opportunity.stage,
      status: opportunity.status,
      accountId: opportunity.accountId,
      contactId: opportunity.contactId,
      ownerId: opportunity.ownerId,
    });

    // Add 2-5 line items per opportunity
    const numLineItems = randInt(2, 5);
    const selectedProducts = priceBookEntries
      .sort(() => Math.random() - 0.5)
      .slice(0, numLineItems);

    let totalAmount = 0;
    for (let j = 0; j < selectedProducts.length; j++) {
      const pbe = selectedProducts[j];
      const quantity = randInt(1, 10);
      const discount = randInt(0, 15);
      const listPrice = Number(pbe.listPrice);
      const unitPrice = listPrice * (1 - discount / 100);
      const lineTotal = quantity * unitPrice;
      totalAmount += lineTotal;

      await prisma.opportunityLineItem.create({
        data: {
          opportunityId: opportunity.id,
          productId: pbe.productId,
          priceBookEntryId: pbe.id,
          quantity,
          listPrice,
          unitPrice,
          discount,
          totalPrice: lineTotal,
          description: `${pbe.product.name} for ${account.name}`,
          sortOrder: j + 1,
        },
      });
    }

    // Update opportunity amount with calculated total
    await prisma.opportunity.update({
      where: { id: opportunity.id },
      data: { amount: totalAmount },
    });

    // Add activity entries for the opportunity
    const activityTypes = [
      "STAGE_CHANGE",
      "NOTE",
      "FIELD_UPDATE",
      "EMAIL_SENT",
      "CALL_LOGGED",
      "MEETING_SCHEDULED",
    ];
    const numActivities = randInt(2, 6);

    for (let k = 0; k < numActivities; k++) {
      const actType = pick(activityTypes);
      let description = "";
      let oldValue: string | null = null;
      let newValue: string | null = null;

      switch (actType) {
        case "STAGE_CHANGE":
          const oldStageIdx = Math.max(0, opportunityStages.indexOf(stage) - 1);
          oldValue = opportunityStages[oldStageIdx];
          newValue = stage;
          description = `Stage changed from ${oldValue} to ${newValue}`;
          break;
        case "NOTE":
          description = pick([
            "Customer showed strong interest in the enterprise package.",
            "Decision maker confirmed budget approval.",
            "Technical team completed their evaluation.",
            "Competitor comparison document shared.",
            "Pricing discussion completed, moving forward.",
          ]);
          break;
        case "FIELD_UPDATE":
          description =
            "Updated expected close date based on customer feedback";
          break;
        case "EMAIL_SENT":
          description = pick([
            "Sent proposal document",
            "Sent follow-up email",
            "Sent case study",
          ]);
          break;
        case "CALL_LOGGED":
          description = pick([
            "Discovery call completed",
            "Demo call scheduled",
            "Pricing discussion call",
          ]);
          break;
        case "MEETING_SCHEDULED":
          description = pick([
            "On-site meeting scheduled",
            "Virtual presentation booked",
            "Technical workshop planned",
          ]);
          break;
      }

      await prisma.opportunityActivity.create({
        data: {
          opportunityId: opportunity.id,
          userId: owner.id,
          activityType: actType,
          description,
          oldValue,
          newValue,
          metadata:
            actType === "MEETING_SCHEDULED"
              ? { location: "Virtual", duration: "60 mins" }
              : null,
          createdAt: randomDateWithin(60),
        },
      });
    }
  }

  console.log(
    `  ✓ Created ${createdOpportunities.length} opportunities with line items and activities`
  );

  // Create Quotes for opportunities that have QUOTE_CREATED status or are in later stages
  console.log("  Creating quotes from opportunities...");

  const opportunitiesForQuotes = createdOpportunities.filter(
    o =>
      o.status === OpportunityStatus.QUOTE_CREATED ||
      o.stage === OpportunityStage.PROPOSAL ||
      o.stage === OpportunityStage.NEGOTIATION ||
      o.stage === OpportunityStage.CLOSED_WON
  );

  const createdQuotes: {
    id: number;
    quoteNumber: string;
    status: QuoteStatus;
    isPrimary: boolean;
    opportunityId: number;
    accountId: number;
    grandTotal: number;
  }[] = [];

  for (const opp of opportunitiesForQuotes) {
    // Get opportunity line items
    const oppLineItems = await prisma.opportunityLineItem.findMany({
      where: { opportunityId: opp.id },
      include: { product: true, priceBookEntry: true },
    });

    // Calculate totals
    const subtotal = oppLineItems.reduce(
      (sum, li) => sum + Number(li.totalPrice),
      0
    );
    const discountPercent = randInt(0, 10);
    const discount = subtotal * (discountPercent / 100);
    const taxPercent = 18; // GST
    const taxAmount = (subtotal - discount) * (taxPercent / 100);
    const shippingAmount = randInt(0, 5000);
    const grandTotal = subtotal - discount + taxAmount + shippingAmount;

    // Determine quote status based on opportunity stage
    let quoteStatus: QuoteStatus = QuoteStatus.DRAFT;
    if (opp.stage === OpportunityStage.CLOSED_WON) {
      quoteStatus = QuoteStatus.ACCEPTED;
    } else if (opp.stage === OpportunityStage.NEGOTIATION) {
      quoteStatus = pick([QuoteStatus.PRESENTED, QuoteStatus.APPROVED]);
    } else if (opp.stage === OpportunityStage.PROPOSAL) {
      quoteStatus = pick([
        QuoteStatus.IN_REVIEW,
        QuoteStatus.APPROVED,
        QuoteStatus.PRESENTED,
      ]);
    }

    const account = allAccounts.find(a => a.id === opp.accountId)!;
    const contact = opp.contactId
      ? allContacts.find(c => c.id === opp.contactId)
      : null;

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const quote = await prisma.quote.create({
      data: {
        quoteNumber: generateQuoteNumber(1),
        name: `Quote for ${account.name}`,
        description: `Quotation based on opportunity requirements`,
        status: quoteStatus,
        type: QuoteType.QUOTE,
        version: 1,
        isPrimary: true,
        subtotal,
        discount,
        discountPercent,
        taxAmount,
        taxPercent,
        shippingAmount,
        grandTotal,
        validUntil,
        approvedAt:
          quoteStatus === QuoteStatus.APPROVED ||
          quoteStatus === QuoteStatus.ACCEPTED ||
          quoteStatus === QuoteStatus.PRESENTED
            ? randomDateWithin(14)
            : null,
        acceptedAt:
          quoteStatus === QuoteStatus.ACCEPTED ? randomDateWithin(7) : null,
        presentedAt:
          quoteStatus === QuoteStatus.PRESENTED ||
          quoteStatus === QuoteStatus.ACCEPTED
            ? randomDateWithin(10)
            : null,
        billingName: account.name,
        billingStreet: "123 Business Park",
        billingCity: pick(cities),
        billingState: pick(states),
        billingPostalCode: pick(pincodes),
        billingCountry: "India",
        shippingName: account.name,
        shippingStreet: "123 Business Park",
        shippingCity: pick(cities),
        shippingState: pick(states),
        shippingPostalCode: pick(pincodes),
        shippingCountry: "India",
        paymentTerms: pick([
          "Net 30",
          "Net 45",
          "Net 60",
          "50% Advance, 50% on Delivery",
        ]),
        deliveryTerms: pick([
          "Within 2 weeks",
          "Within 30 days",
          "As per schedule",
        ]),
        notes: "Thank you for your business. This quote is valid for 30 days.",
        internalNotes: "Standard pricing applied with approved discount.",
        opportunityId: opp.id,
        accountId: opp.accountId,
        contactId: opp.contactId,
        preparedById: opp.ownerId,
        approvedById:
          quoteStatus !== QuoteStatus.DRAFT &&
          quoteStatus !== QuoteStatus.IN_REVIEW
            ? adminUser.id
            : null,
      },
    });

    createdQuotes.push({
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      status: quote.status,
      isPrimary: quote.isPrimary,
      opportunityId: quote.opportunityId,
      accountId: quote.accountId,
      grandTotal: Number(quote.grandTotal),
    });

    // Copy line items from opportunity to quote
    for (let j = 0; j < oppLineItems.length; j++) {
      const oli = oppLineItems[j];
      await prisma.quoteLineItem.create({
        data: {
          quoteId: quote.id,
          productId: oli.productId,
          priceBookEntryId: oli.priceBookEntryId,
          quantity: oli.quantity,
          listPrice: oli.listPrice,
          unitPrice: oli.unitPrice,
          discount: oli.discount,
          totalPrice: oli.totalPrice,
          description: oli.description,
          sortOrder: oli.sortOrder,
        },
      });
    }
  }

  console.log(`  ✓ Created ${createdQuotes.length} quotes with line items`);

  // Create Sales Orders from ACCEPTED quotes
  console.log("  Creating sales orders from accepted quotes...");

  const acceptedQuotes = createdQuotes.filter(
    q => q.status === QuoteStatus.ACCEPTED
  );
  const createdOrders: {
    id: number;
    orderNumber: string;
    status: SalesOrderStatus;
  }[] = [];

  for (const quote of acceptedQuotes) {
    const fullQuote = await prisma.quote.findUnique({
      where: { id: quote.id },
      include: { lineItems: { include: { product: true } } },
    });

    if (!fullQuote) continue;

    // Determine order status - some delivered, some in progress
    const orderStatus = pick([
      SalesOrderStatus.APPROVED,
      SalesOrderStatus.IN_FULFILLMENT,
      SalesOrderStatus.SHIPPED,
      SalesOrderStatus.DELIVERED,
    ]);

    const expectedShip = new Date();
    expectedShip.setDate(expectedShip.getDate() + randInt(7, 21));

    const expectedDelivery = new Date(expectedShip);
    expectedDelivery.setDate(expectedDelivery.getDate() + randInt(3, 7));

    const order = await prisma.salesOrder.create({
      data: {
        orderNumber: generateOrderNumber(),
        name: `Order - ${fullQuote.name}`,
        description: fullQuote.description,
        status: orderStatus,
        subtotal: fullQuote.subtotal,
        discount: fullQuote.discount,
        discountPercent: fullQuote.discountPercent,
        taxAmount: fullQuote.taxAmount,
        taxPercent: fullQuote.taxPercent,
        shippingAmount: fullQuote.shippingAmount,
        grandTotal: fullQuote.grandTotal,
        orderDate: randomDateWithin(14),
        expectedShipDate: expectedShip,
        actualShipDate:
          orderStatus === SalesOrderStatus.SHIPPED ||
          orderStatus === SalesOrderStatus.DELIVERED
            ? randomDateWithin(7)
            : null,
        expectedDeliveryDate: expectedDelivery,
        actualDeliveryDate:
          orderStatus === SalesOrderStatus.DELIVERED
            ? randomDateWithin(3)
            : null,
        approvedAt:
          orderStatus !== SalesOrderStatus.DRAFT &&
          orderStatus !== SalesOrderStatus.PENDING_APPROVAL
            ? randomDateWithin(10)
            : null,
        billingName: fullQuote.billingName,
        billingStreet: fullQuote.billingStreet,
        billingCity: fullQuote.billingCity,
        billingState: fullQuote.billingState,
        billingPostalCode: fullQuote.billingPostalCode,
        billingCountry: fullQuote.billingCountry,
        shippingName: fullQuote.shippingName,
        shippingStreet: fullQuote.shippingStreet,
        shippingCity: fullQuote.shippingCity,
        shippingState: fullQuote.shippingState,
        shippingPostalCode: fullQuote.shippingPostalCode,
        shippingCountry: fullQuote.shippingCountry,
        paymentTerms: fullQuote.paymentTerms,
        deliveryTerms: fullQuote.deliveryTerms,
        notes: fullQuote.notes,
        internalNotes: "Order created from accepted quote.",
        quoteId: fullQuote.id,
        accountId: fullQuote.accountId,
        contactId: fullQuote.contactId,
        ownerId: fullQuote.preparedById,
        approvedById: adminUser.id,
      },
    });

    createdOrders.push({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
    });

    // Copy line items from quote to order
    for (const qli of fullQuote.lineItems) {
      await prisma.salesOrderLineItem.create({
        data: {
          salesOrderId: order.id,
          productId: qli.productId,
          quantity: qli.quantity,
          listPrice: qli.listPrice,
          unitPrice: qli.unitPrice,
          discount: qli.discount,
          totalPrice: qli.totalPrice,
          description: qli.description,
          sortOrder: qli.sortOrder,
        },
      });
    }
  }

  console.log(
    `  ✓ Created ${createdOrders.length} sales orders with line items`
  );

  console.log("\n✅ Opportunity-Quote-Order seed data complete!");
  console.log(`   - ${createdOpportunities.length} Opportunities`);
  console.log(`   - ${createdQuotes.length} Quotes`);
  console.log(`   - ${createdOrders.length} Sales Orders`);

  // Log all created user credentials for easy reference
  console.log("\n" + "=".repeat(80));
  console.log("🎉 DATABASE SEEDED SUCCESSFULLY!");
  console.log("=".repeat(80));
  console.log("\n📋 USER ACCOUNTS CREATED - LOGIN CREDENTIALS:\n");

  console.log(
    "┌─────────────────────────────────────────────────────────────────────────────┐"
  );
  console.log(
    "│ 1. SYSTEM ADMIN (Full System Access)                                       │"
  );
  console.log(
    "├─────────────────────────────────────────────────────────────────────────────┤"
  );
  console.log(`│ Email:    ${superAdminUser.email.padEnd(64)} │`);
  console.log(
    "│ Password: admin123                                                          │"
  );
  console.log(
    "│ Role:     ADMIN                                                             │"
  );
  console.log(
    "└─────────────────────────────────────────────────────────────────────────────┘"
  );

  console.log(
    "\n┌─────────────────────────────────────────────────────────────────────────────┐"
  );
  console.log(
    "│ 2. ADMIN (Admin Access)                                                     │"
  );
  console.log(
    "├─────────────────────────────────────────────────────────────────────────────┤"
  );
  console.log(`│ Email:    ${adminUser.email.padEnd(64)} │`);
  console.log(
    "│ Password: admin123                                                          │"
  );
  console.log(
    "│ Role:     ADMIN                                                             │"
  );
  console.log(
    "└─────────────────────────────────────────────────────────────────────────────┘"
  );

  console.log(
    "\n┌─────────────────────────────────────────────────────────────────────────────┐"
  );
  console.log(
    "│ 3. DEVELOPER (Developer Access - Matches .env)                              │"
  );
  console.log(
    "├─────────────────────────────────────────────────────────────────────────────┤"
  );
  console.log(`│ Email:    ${developerUser.email.padEnd(64)} │`);
  console.log(
    "│ Password: admin123 (for seed) OR your DEVELOPER_LOGIN_PASSWORD from .env   │"
  );
  console.log(
    "│ Role:     ADMIN                                                             │"
  );
  console.log(
    "│                                                                             │"
  );
  console.log(
    "│ ⚠️  IMPORTANT: For developer login to work, add these to your .env:         │"
  );
  console.log(
    '│     DEVELOPER_LOGIN_EMAIL="developer@example.com"                           │'
  );
  console.log(
    '│     DEVELOPER_LOGIN_PASSWORD="admin123"                         │'
  );
  console.log(
    '│     DEVELOPER_LOGIN_NAME="Developer Access"                                 │'
  );
  console.log(
    "└─────────────────────────────────────────────────────────────────────────────┘"
  );

  console.log(
    "\n┌─────────────────────────────────────────────────────────────────────────────┐"
  );
  console.log(
    "│ 4. SALES USERS (Sales Access)                                               │"
  );
  console.log(
    "├─────────────────────────────────────────────────────────────────────────────┤"
  );
  salesUsers.forEach((user, index) => {
    console.log(`│ Email:    ${user.email.padEnd(64)} │`);
    if (index === 0) {
      console.log(
        "│ Password: admin123                                                          │"
      );
      console.log(
        "│ Role:     SALES                                                             │"
      );
    }
    if (index < salesUsers.length - 1) {
      console.log(
        "├─────────────────────────────────────────────────────────────────────────────┤"
      );
    }
  });
  console.log(
    "└─────────────────────────────────────────────────────────────────────────────┘"
  );

  console.log("\n" + "=".repeat(80));
  console.log("📍 QUICK START:");
  console.log("=".repeat(80));
  console.log("1. Start the app:    npm run dev");
  console.log("2. Open frontend:    http://localhost:3000");
  console.log("3. Login with any of the accounts above");
  console.log("\n💡 TIP: Use ADMIN for full access during development");
  console.log("=".repeat(80) + "\n");
}

main()
  .catch(e => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
