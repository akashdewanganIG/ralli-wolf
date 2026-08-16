// Simple script to send leads to Brevo
// This bypasses the controller issues and sends leads directly

import dotenv from "dotenv";
import axios from "axios";

// Load environment variables
dotenv.config({ path: "../../.env" });

async function sendLeadsToBrevo() {
  console.log("🚀 Sending Leads to Brevo...\n");

  const apiKey = process.env.BREVO_API_KEY;
  const baseURL = process.env.BREVO_BASE_URL || "https://api.brevo.com/v3";

  if (!apiKey) {
    console.error("❌ BREVO_API_KEY not found");
    return;
  }

  // Sample leads data (replace with your actual leads)
  const leads = [
    {
      name: "John Doe",
      email: "john@example.com",
      companyName: "Acme Corp",
      source: "Website",
      score: 75,
    },
    {
      name: "Jane Smith",
      email: "jane@example.com",
      companyName: "Tech Inc",
      source: "Referral",
      score: 60,
    },
    {
      name: "Bob Johnson",
      email: "bob@example.com",
      companyName: "Startup Co",
      source: "Social Media",
      score: 45,
    },
  ];

  console.log(`📊 Processing ${leads.length} leads...\n`);

  const results = {
    successful: [],
    failed: [],
  };

  for (const lead of leads) {
    try {
      console.log(`📤 Sending lead: ${lead.name} (${lead.email})`);

      // Prepare Brevo contact data
      const brevoContact = {
        email: lead.email,
        attributes: {
          FIRSTNAME: lead.name.split(" ")[0] || "",
          LASTNAME: lead.name.split(" ").slice(1).join(" ") || "",
          COMPANY: lead.companyName || "",
          SOURCE: lead.source || "CRM",
          LEAD_SCORE: lead.score || 0,
        },
        updateEnabled: true,
      };

      // Phone numbers removed to avoid validation issues

      // Send to Brevo
      const response = await axios.post(`${baseURL}/contacts`, brevoContact, {
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
      });

      results.successful.push({
        name: lead.name,
        email: lead.email,
        brevoContactId: response.data.id,
      });

      console.log(`✅ Success: Contact ID ${response.data.id}`);
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;

      if (errorMessage.includes("already exists")) {
        console.log(`⚠️ Contact already exists: ${lead.email}`);
        results.successful.push({
          name: lead.name,
          email: lead.email,
          status: "already_exists",
        });
      } else {
        console.log(`❌ Failed: ${errorMessage}`);
        results.failed.push({
          name: lead.name,
          email: lead.email,
          error: errorMessage,
        });
      }
    }

    console.log(""); // Empty line for readability
  }

  // Summary
  console.log("📊 SUMMARY:");
  console.log(`✅ Successful: ${results.successful.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(
    `📈 Success Rate: ${((results.successful.length / leads.length) * 100).toFixed(1)}%`
  );

  if (results.successful.length > 0) {
    console.log("\n✅ Successfully sent leads:");
    results.successful.forEach(lead => {
      console.log(`  - ${lead.name} (${lead.email})`);
    });
  }

  if (results.failed.length > 0) {
    console.log("\n❌ Failed to send:");
    results.failed.forEach(lead => {
      console.log(`  - ${lead.name} (${lead.email}): ${lead.error}`);
    });
  }

  console.log("\n🎉 Lead sync completed!");
  console.log("\n📋 Next steps:");
  console.log("1. Check your Brevo dashboard to see the contacts");
  console.log("2. Create campaigns in Brevo");
  console.log("3. Send campaigns to these contacts");
}

// Run the script
sendLeadsToBrevo();
