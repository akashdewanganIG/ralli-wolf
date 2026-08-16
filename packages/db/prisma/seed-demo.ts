import { LeadSource, LeadStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const companies = [
  {
    name: "Apex Motion Systems",
    industry: "Industrial Automation",
    website: "https://apex-motion.demo.example",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411045",
  },
  {
    name: "BluePeak Material Handling",
    industry: "Material Handling",
    website: "https://bluepeak.demo.example",
    city: "Ahmedabad",
    state: "Gujarat",
    pincode: "380015",
  },
  {
    name: "Crestline Warehousing",
    industry: "Warehousing & Logistics",
    website: "https://crestline.demo.example",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560048",
  },
  {
    name: "DeltaForge Components",
    industry: "Automotive Components",
    website: "https://deltaforge.demo.example",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600058",
  },
  {
    name: "Evergreen Process Equipment",
    industry: "Process Manufacturing",
    website: "https://evergreen.demo.example",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500081",
  },
  {
    name: "Frontier Cold Chain",
    industry: "Cold Chain Logistics",
    website: "https://frontier.demo.example",
    city: "Gurugram",
    state: "Haryana",
    pincode: "122016",
  },
  {
    name: "GraniteWorks Engineering",
    industry: "Heavy Engineering",
    website: "https://graniteworks.demo.example",
    city: "Kolkata",
    state: "West Bengal",
    pincode: "700091",
  },
  {
    name: "Horizon Retail Fulfilment",
    industry: "Retail Fulfilment",
    website: "https://horizon.demo.example",
    city: "Noida",
    state: "Uttar Pradesh",
    pincode: "201301",
  },
];

const people = [
  ["Aarav", "Mehta"],
  ["Ananya", "Iyer"],
  ["Vikram", "Shah"],
  ["Priya", "Nair"],
  ["Rohan", "Kapoor"],
  ["Meera", "Kulkarni"],
  ["Arjun", "Reddy"],
  ["Kavya", "Menon"],
  ["Siddharth", "Bose"],
  ["Neha", "Agarwal"],
  ["Aditya", "Deshmukh"],
  ["Ishita", "Malhotra"],
  ["Rahul", "Chopra"],
  ["Sneha", "Rao"],
  ["Karan", "Bhatia"],
  ["Diya", "Mukherjee"],
  ["Nikhil", "Joshi"],
  ["Pooja", "Saxena"],
  ["Varun", "Khanna"],
  ["Riya", "Patel"],
  ["Abhishek", "Singh"],
  ["Tanvi", "Gupta"],
  ["Manish", "Verma"],
  ["Aditi", "Jain"],
  ["Harsh", "Trivedi"],
  ["Nandini", "Pillai"],
  ["Sanjay", "Kumar"],
  ["Shreya", "Das"],
  ["Dev", "Bhandari"],
  ["Sakshi", "Arora"],
  ["Mohit", "Sethi"],
  ["Lakshmi", "Krishnan"],
  ["Yash", "Goel"],
  ["Avni", "Chatterjee"],
  ["Gaurav", "Mishra"],
  ["Simran", "Kaur"],
] as const;

const statuses = [
  LeadStatus.OPEN,
  LeadStatus.WORKING,
  LeadStatus.QUALIFIED,
  LeadStatus.NURTURING,
  LeadStatus.CONVERTED,
  LeadStatus.WORKING,
] as const;
const sources = [
  LeadSource.LANDING_PAGE,
  LeadSource.MANUAL,
  LeadSource.IMPORT,
] as const;

function createdDaysAgo(days: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 15, 0, 0);
  return date;
}

async function main() {
  const accounts = new Map<string, number>();
  const seededAccounts = await Promise.all(
    companies.map(company =>
      prisma.account.upsert({
        where: { name: company.name },
        update: { industry: company.industry, website: company.website },
        create: {
          name: company.name,
          industry: company.industry,
          website: company.website,
        },
      })
    )
  );
  seededAccounts.forEach((account, index) => {
    accounts.set(companies[index]!.name, account.id);
  });

  const demoEmails = people.map(
    ([firstName, lastName], index) =>
      `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${String(index + 1).padStart(2, "0")}@crm-demo.example`
  );
  const existingLeads = await prisma.lead.findMany({
    where: { email: { in: demoEmails } },
  });
  const existingLeadByEmail = new Map(
    existingLeads.map(lead => [lead.email, lead])
  );

  let created = 0;
  let updated = 0;
  let contacts = 0;

  for (let index = 0; index < people.length; index++) {
    const person = people[index]!;
    const company = companies[index % companies.length]!;
    const firstName = person[0];
    const lastName = person[1];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${String(index + 1).padStart(2, "0")}@crm-demo.example`;
    const status = statuses[index % statuses.length]!;
    const source = sources[index % sources.length]!;
    const createdAt = createdDaysAgo(index % 21, 9 + (index % 8));
    const existing = existingLeadByEmail.get(email);
    const data = {
      firstName,
      lastName,
      email,
      phone: String(9000000000 + index + 101),
      companyName: company.name,
      city: company.city,
      state: company.state,
      pincode: company.pincode,
      countryCode: "91",
      source,
      status,
      score: 48 + ((index * 7) % 51),
      qualityScore: 62 + ((index * 5) % 37),
      completenessScore: 92,
      missingFields: [],
      invalidFields: [],
      createdAt,
      deletedAt: null,
    };

    const lead = existing
      ? await prisma.lead.update({ where: { id: existing.id }, data })
      : await prisma.lead.create({ data });
    existing ? updated++ : created++;

    if (status === LeadStatus.CONVERTED || status === LeadStatus.QUALIFIED) {
      const contact = await prisma.contact.upsert({
        where: { email },
        update: {
          name: `${firstName} ${lastName}`,
          phone: data.phone,
          accountId: accounts.get(company.name),
          city: company.city,
          state: company.state,
          pincode: company.pincode,
        },
        create: {
          name: `${firstName} ${lastName}`,
          email,
          phone: data.phone,
          position: index % 2 ? "Operations Manager" : "Procurement Lead",
          accountId: accounts.get(company.name),
          city: company.city,
          state: company.state,
          pincode: company.pincode,
          createdAt,
        },
      });
      contacts++;
      if (
        status === LeadStatus.CONVERTED &&
        lead.convertedToContactId !== contact.id
      ) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { convertedToContactId: contact.id },
        });
      }
    }
  }

  const [leadTotal, accountTotal, contactTotal] = await Promise.all([
    prisma.lead.count({ where: { email: { endsWith: "@crm-demo.example" } } }),
    prisma.account.count({ where: { website: { endsWith: ".demo.example" } } }),
    prisma.contact.count({
      where: { email: { endsWith: "@crm-demo.example" } },
    }),
  ]);
  console.log(
    `Demo CRM data ready: ${leadTotal} leads (${created} created, ${updated} refreshed), ${accountTotal} accounts, ${contactTotal} contacts (${contacts} linked).`
  );
}

main()
  .catch(error => {
    console.error("Demo seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
