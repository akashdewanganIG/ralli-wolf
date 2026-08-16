import { PrismaClient, LeadStatus } from "@prisma/client";

const prisma = new PrismaClient();

function buildLeadName(firstName: string | null, lastName: string | null) {
  if (firstName && lastName) return `${firstName} ${lastName}`.trim();
  return firstName || lastName || "Unknown Lead";
}

async function getOrCreateAccount(companyName?: string | null) {
  if (!companyName?.trim()) {
    return null;
  }

  const existing = await prisma.account.findUnique({
    where: { name: companyName },
  });
  if (existing) {
    return existing.id;
  }

  const created = await prisma.account.create({
    data: {
      name: companyName,
    },
  });

  return created.id;
}

async function getOrCreateContactFromLead(lead: {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
}) {
  if (!lead.email) {
    throw new Error(
      `Lead ${lead.id} does not have an email, cannot create contact`
    );
  }

  const existingContact = await prisma.contact.findUnique({
    where: { email: lead.email },
  });
  if (existingContact) {
    return existingContact;
  }

  const accountId = await getOrCreateAccount(lead.companyName);
  const name = buildLeadName(lead.firstName, lead.lastName);

  return prisma.contact.create({
    data: {
      name,
      email: lead.email,
      phone: lead.phone,
      accountId: accountId ?? undefined,
    },
  });
}

async function backfillConvertedLeads() {
  const leads = await prisma.lead.findMany({
    where: {
      status: LeadStatus.CONVERTED,
      convertedToContactId: null,
    },
    orderBy: { id: "asc" },
  });

  if (leads.length === 0) {
    console.log(
      "✅ No converted leads without contacts found. Nothing to backfill."
    );
    return;
  }

  console.log(
    `🔍 Found ${leads.length} converted leads without contacts. Starting backfill...`
  );

  let successCount = 0;
  const failures: Array<{ leadId: number; reason: string }> = [];

  for (const lead of leads) {
    try {
      const contact = await getOrCreateContactFromLead(lead);
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          convertedToContactId: contact.id,
        },
      });
      successCount++;
      console.log(`✓ Linked lead ${lead.id} to contact ${contact.id}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      failures.push({ leadId: lead.id, reason });
      console.error(`✗ Failed to backfill lead ${lead.id}: ${reason}`);
    }
  }

  console.log("--------------------------------------------------");
  console.log(`✅ Successfully backfilled ${successCount} leads.`);
  if (failures.length) {
    console.warn(
      `⚠️ ${failures.length} leads could not be backfilled. See details below:`
    );
    failures.forEach(f => console.warn(` - Lead ${f.leadId}: ${f.reason}`));
  } else {
    console.log("🎉 All converted leads now have linked contacts.");
  }
}

backfillConvertedLeads()
  .catch(error => {
    console.error("❌ Backfill script failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
