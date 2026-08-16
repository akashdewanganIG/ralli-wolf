// Test script for Brevo integration
// Run this with: npx tsx test-brevo.js

import { BrevoService } from "./src/services/brevo.service.ts";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function testBrevoIntegration() {
  console.log("🧪 Testing Brevo Integration...\n");

  try {
    // Initialize Brevo service
    const brevoService = new BrevoService();

    // Test 1: Connection Test
    console.log("1️⃣ Testing API Connection...");
    const isConnected = await brevoService.testConnection();
    console.log(`   Result: ${isConnected ? "✅ Connected" : "❌ Failed"}\n`);

    if (!isConnected) {
      console.log("❌ Cannot proceed with tests - API connection failed");
      console.log("   Please check your BREVO_API_KEY in .env file");
      return;
    }

    // Test 2: Get Account Statistics
    console.log("2️⃣ Testing Account Statistics...");
    const stats = await brevoService.getAccountStatistics();
    console.log(`   ✅ Account Stats Retrieved:`);
    console.log(`   - Email Credits: ${stats.emailCredits}`);
    console.log(`   - Total Sent: ${stats.statistics.totalSent}\n`);

    // Test 3: Get Campaigns
    console.log("3️⃣ Testing Campaign Retrieval...");
    const campaigns = await brevoService.getAllCampaigns(5, 0);
    console.log(`   ✅ Found ${campaigns.count} campaigns`);
    console.log(
      `   - Showing first ${campaigns.campaigns.length} campaigns:\n`
    );

    campaigns.campaigns.forEach((campaign, index) => {
      console.log(`   ${index + 1}. ${campaign.name} (${campaign.status})`);
    });

    console.log("\n🎉 All tests completed successfully!");
    console.log("\n📋 Next Steps:");
    console.log("1. Start your database: docker-compose up -d");
    console.log("2. Run migration: npx prisma migrate dev");
    console.log("3. Start the API server: npm run dev");
    console.log("4. Test the endpoints using the API documentation");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.log("\n🔧 Troubleshooting:");
    console.log("1. Check your BREVO_API_KEY in .env file");
    console.log("2. Verify your internet connection");
    console.log("3. Check Brevo API status");
  }
}

// Run the test
testBrevoIntegration();
