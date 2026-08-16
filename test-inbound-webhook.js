/**
 * Test script for MSG91 inbound webhook
 *
 * This script simulates MSG91 sending an inbound STOP message to your webhook
 * Run this to verify your webhook endpoint is working correctly
 */

const API_URL = 'https://ma-rachidial-tressa.ngrok-free.dev/api/webhook/msg91/whatsapp/inbound';

// Sample MSG91 inbound message payloads (multiple formats to test)
const testPayloads = [
  // Format 1: Common MSG91 inbound format
  {
    name: 'Format 1 - Standard',
    payload: {
      from: '919876543210',
      text: 'STOP',
      message_id: 'test-msg-123',
      timestamp: new Date().toISOString(),
      type: 'text'
    }
  },
  // Format 2: Alternative field names
  {
    name: 'Format 2 - Alternative fields',
    payload: {
      sender: '919876543210',
      message: 'stop',
      id: 'test-msg-456',
      receivedAt: new Date().toISOString()
    }
  },
  // Format 3: Nested data object
  {
    name: 'Format 3 - Nested data',
    payload: {
      data: {
        from: '919876543210',
        text: 'STOP',
        message_uuid: 'test-msg-789'
      },
      event: 'inbound_message',
      timestamp: new Date().toISOString()
    }
  },
  // Format 4: With body field
  {
    name: 'Format 4 - Body field',
    payload: {
      phone: '919876543210',
      body: 'unsubscribe',
      messageId: 'test-msg-999',
      date: new Date().toISOString()
    }
  }
];

async function testWebhook(testCase) {
  console.log(`\n========================================`);
  console.log(`Testing: ${testCase.name}`);
  console.log(`========================================`);
  console.log('Payload:', JSON.stringify(testCase.payload, null, 2));

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add ngrok-skip-browser-warning header to bypass ngrok warning page
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'MSG91-Webhook-Test/1.0'
      },
      body: JSON.stringify(testCase.payload)
    });

    console.log(`\nResponse Status: ${response.status} ${response.statusText}`);

    const responseText = await response.text();
    console.log('Response Body:', responseText);

    try {
      const jsonResponse = JSON.parse(responseText);
      console.log('\nParsed Response:', JSON.stringify(jsonResponse, null, 2));

      if (jsonResponse.success) {
        console.log('✅ SUCCESS - Webhook processed successfully!');
        if (jsonResponse.isOptOut) {
          console.log('✅ OPT-OUT - User was opted out!');
        }
      } else {
        console.log('⚠️  WARNING - Webhook returned success:false');
      }
    } catch (e) {
      console.log('⚠️  Response is not JSON:', responseText.substring(0, 200));
    }

  } catch (error) {
    console.error('❌ ERROR - Failed to call webhook:');
    console.error('Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }

  console.log(`========================================\n`);
}

async function runTests() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  MSG91 Inbound Webhook Test Script       ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`\nTarget URL: ${API_URL}`);
  console.log(`Running ${testPayloads.length} test cases...\n`);

  for (const testCase of testPayloads) {
    await testWebhook(testCase);
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n✨ All tests completed!');
  console.log('\nNow check your server logs to see if the webhook was received.');
  console.log('Look for logs starting with: "=== INBOUND MESSAGE WEBHOOK CALLED ==="');
}

// Run the tests
runTests().catch(console.error);
