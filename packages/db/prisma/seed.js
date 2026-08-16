"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("🌱 Seeding database...");
    // Create admin user with full permissions
    const adminUser = await prisma.user.upsert({
        where: { email: "admin@innovun.com" },
        update: {},
        create: {
            name: "System Administrator",
            email: "admin@innovun.com",
            passwordHash: "$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJByJ.Xd5c3z2y7BZ8K", // "admin123"
            permissions: {
                create: {
                    leadManagement: true,
                    campaignManagement: true,
                    chatbotAccess: true,
                    whatsappCampaign: true,
                    emailMarketing: true,
                    systemAdminAccess: true
                }
            }
        }
    });
    // Create sales user with limited permissions
    const salesUser = await prisma.user.upsert({
        where: { email: "sarah.sales@innovun.com" },
        update: {},
        create: {
            name: "Sarah Sales",
            email: "sarah.sales@innovun.com",
            passwordHash: "$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJByJ.Xd5c3z2y7BZ8K", // "sales123"
            permissions: {
                create: {
                    leadManagement: true,
                    campaignManagement: false,
                    chatbotAccess: false,
                    whatsappCampaign: false,
                    emailMarketing: false,
                    systemAdminAccess: false
                }
            }
        }
    });
    // Create marketing user with marketing permissions
    const marketingUser = await prisma.user.upsert({
        where: { email: "mike.marketing@innovun.com" },
        update: {},
        create: {
            name: "Mike Marketing",
            email: "mike.marketing@innovun.com",
            passwordHash: "$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJByJ.Xd5c3z2y7BZ8K", // "marketing123"
            permissions: {
                create: {
                    leadManagement: true,
                    campaignManagement: true,
                    chatbotAccess: false,
                    whatsappCampaign: true,
                    emailMarketing: true,
                    systemAdminAccess: false
                }
            }
        }
    });
    // Create sample accounts
    const accounts = [
        {
            name: "TechCorp Solutions",
            industry: "Technology",
            website: "https://techcorp.com"
        },
        {
            name: "Marketing Pro Inc",
            industry: "Marketing",
            website: "https://marketingpro.com"
        },
        {
            name: "Global Enterprises",
            industry: "Consulting",
            website: "https://globalent.com"
        }
    ];
    const createdAccounts = [];
    for (const account of accounts) {
        const created = await prisma.account.upsert({
            where: { name: account.name },
            update: {},
            create: account
        });
        createdAccounts.push(created);
    }
    // Create sample contacts
    const contacts = [
        {
            name: "John Smith",
            email: "john.smith@techcorp.com",
            phone: "+1-555-0123",
            position: "CTO",
            accountId: createdAccounts[0].id
        },
        {
            name: "Sarah Johnson",
            email: "sarah.j@marketingpro.com",
            phone: "+1-555-0456",
            position: "Marketing Director",
            accountId: createdAccounts[1].id
        },
        {
            name: "Mike Davis",
            email: "mike.davis@globalent.com",
            phone: "+1-555-0789",
            position: "VP Sales",
            accountId: createdAccounts[2].id
        }
    ];
    const createdContacts = [];
    for (const contact of contacts) {
        const created = await prisma.contact.upsert({
            where: { email: contact.email },
            update: {},
            create: contact
        });
        createdContacts.push(created);
    }
    // Create sample leads
    const leads = [
        {
            name: "Alice Brown",
            email: "alice.brown@email.com",
            phone: "+1-555-0321",
            source: "Website",
            status: "New",
            ownerId: salesUser.id,
            score: 85
        },
        {
            name: "Bob Wilson",
            email: "bob.wilson@email.com",
            phone: "+1-555-0654",
            source: "Referral",
            status: "Qualified",
            ownerId: salesUser.id,
            score: 92
        },
        {
            name: "Carol Green",
            email: "carol.green@email.com",
            phone: "+1-555-0987",
            source: "Trade Show",
            status: "Contacted",
            ownerId: marketingUser.id,
            score: 78
        }
    ];
    const createdLeads = [];
    for (const lead of leads) {
        const created = await prisma.lead.upsert({
            where: { email: lead.email },
            update: {},
            create: lead
        });
        createdLeads.push(created);
    }
    // Create sample campaign
    const campaign = await prisma.campaign.create({
        data: {
            name: "Q1 2024 Product Launch",
            description: "Launch campaign for our new product line",
            startDate: new Date("2024-01-01"),
            endDate: new Date("2024-03-31"),
            createdBy: marketingUser.id
        }
    });
    // Add contacts and leads to campaign
    for (const contact of createdContacts) {
        await prisma.campaignMember.create({
            data: {
                campaignId: campaign.id,
                contactId: contact.id,
                status: "Invited"
            }
        });
    }
    for (const lead of createdLeads) {
        await prisma.campaignMember.create({
            data: {
                campaignId: campaign.id,
                leadId: lead.id,
                status: "Invited"
            }
        });
    }
    // Create lead assignment rules
    await prisma.leadAssignmentRule.create({
        data: {
            name: "High Score Leads",
            criteria: {
                score_gte: 90,
                source: "Website"
            },
            assignedUserId: salesUser.id,
            priority: 1,
            active: true
        }
    });
    console.log("✅ Database seeded successfully!");
    console.log(`Created 3 users with individual permissions`);
    console.log(`Created ${createdAccounts.length} accounts`);
    console.log(`Created ${createdContacts.length} contacts`);
    console.log(`Created ${createdLeads.length} leads`);
    console.log(`Created 1 campaign with ${createdContacts.length + createdLeads.length} members`);
}
main()
    .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
