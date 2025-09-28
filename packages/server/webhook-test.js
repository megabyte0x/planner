const axios = require('axios');

// Test webhook payload based on Alchemy address activity webhook format
const testWebhookPayload = {
  webhookId: "wh_test123",
  id: "test_event_456",
  createdAt: new Date().toISOString(),
  type: "ADDRESS_ACTIVITY",
  event: {
    network: "BASE_MAINNET",
    activity: [
      {
        fromAddress: "0x1234567890123456789012345678901234567890",
        toAddress: "0x0000000000000000000000000000000000000000", // This should be your planner contract
        blockNum: "0x123456",
        hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        value: 100,
        asset: "USDC",
        category: "token",
        rawContract: {
          address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // Base USDC address (example)
          decimal: 6
        }
      }
    ]
  }
};

async function testWebhook() {
  try {
    console.log('Testing webhook endpoint...');
    console.log('Payload:', JSON.stringify(testWebhookPayload, null, 2));

    const response = await axios.post('http://localhost:3001/webhook/alchemy', testWebhookPayload, {
      headers: {
        'Content-Type': 'application/json',
        // If you have webhook signature verification enabled, you'd need to generate the proper signature here
      }
    });

    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
    console.log('✅ Webhook test successful!');

  } catch (error) {
    console.error('❌ Webhook test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testWebhookPayload.event.activity[0].toAddress = process.argv[2] || testWebhookPayload.event.activity[0].toAddress;
  testWebhookPayload.event.activity[0].rawContract.address = process.argv[3] || testWebhookPayload.event.activity[0].rawContract.address;

  console.log('Usage: node webhook-test.js [plannerAddress] [tokenAddress]');
  console.log('Example: node webhook-test.js 0x1234...planner 0x5678...usdc');
  console.log('');

  testWebhook();
}

module.exports = { testWebhookPayload, testWebhook };