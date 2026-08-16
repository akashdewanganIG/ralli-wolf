/**
 * Simple test script to demonstrate Landingi webhook functionality
 * Run this after starting the API server to test lead storage
 */

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const testPayloads = JSON.parse(
  await readFile(
    new URL("./test-webhook-payloads.json", import.meta.url),
    "utf8"
  )
);

async function testWebhook(payload, description) {
  try {
    console.log(`\n🧪 Testing: ${description}`);
    console.log("📦 Payload:", JSON.stringify(payload, null, 2));

    const response = await fetch("http://localhost:4000/api/webhook/landingi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log("✅ Response:", JSON.stringify(result, null, 2));

    if (result.leadCreated) {
      console.log(`🎉 Lead created successfully! Lead ID: ${result.leadId}`);
    } else {
      console.log("⚠️ No lead was created");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

async function runTests() {
  console.log("🚀 Starting Landingi Webhook Tests");
  console.log(
    "📋 Make sure the API server is running on http://localhost:4000"
  );

  // Test form submission format
  await testWebhook(
    testPayloads.form_submission_example,
    "Form Submission Format"
  );

  // Test lead object format
  await testWebhook(testPayloads.lead_object_example, "Lead Object Format");

  // Test direct fields format
  await testWebhook(testPayloads.direct_fields_example, "Direct Fields Format");

  // Test custom fields format
  await testWebhook(testPayloads.custom_fields_example, "Custom Fields Format");

  // Test minimal format
  await testWebhook(testPayloads.minimal_example, "Minimal Format");

  console.log("\n🏁 All tests completed!");
}

// Run tests if this script is executed directly
const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (entryUrl === import.meta.url) {
  runTests().catch(console.error);
}

export { testWebhook, runTests };
