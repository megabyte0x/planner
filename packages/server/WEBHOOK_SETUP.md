# Alchemy Webhook Setup Guide

This guide explains how to set up and use Alchemy Address Activity webhooks for real-time deposit detection in the DCA Watcher Service.

## Overview

The DCA Watcher Service now supports two methods for detecting deposits:
1. **WebSocket Monitoring** (default): Direct WebSocket connection to Alchemy
2. **Webhook Notifications** (recommended): HTTP webhooks from Alchemy

Webhooks are more reliable and don't require maintaining persistent connections.

## Configuration

### Environment Variables

Add these environment variables to enable webhook support:

```bash
# Enable webhook mode
WEBHOOK_ENABLED=true

# Webhook endpoint path (optional, defaults to /webhook/alchemy)
WEBHOOK_PATH=/webhook/alchemy

# Webhook secret for signature verification (recommended for production)
WEBHOOK_SECRET=your_secret_key_here
```

### Example .env file
```
WEBHOOK_ENABLED=true
WEBHOOK_PATH=/webhook/alchemy
WEBHOOK_SECRET=mysecretkey123
```

## Alchemy Webhook Setup

1. **Create an Address Activity Webhook** in your Alchemy Dashboard
2. **Set the webhook URL** to your server's webhook endpoint:
   ```
   https://your-domain.com/webhook/alchemy
   ```
3. **Add monitored addresses**:
   - ETH Planner contract address
   - ERC20 Planner contract address
4. **Configure webhook settings**:
   - Type: "Address Activity"
   - Network: Your target network (Base, Ethereum, etc.)
   - Activity Types: Select "Token Transfers"

## Address Configuration

You need to monitor these addresses for incoming token transfers:

### Contracts to Monitor
- **ETH Planner Contract**: Receives USDC/DAI deposits for ETH swaps
- **ERC20 Planner Contract**: Receives USDC/DAI deposits for ERC-20 token swaps

### Tokens to Track
- **USDC**: Primary stablecoin for deposits
- **DAI**: Secondary stablecoin for deposits

## Security

### Webhook Signature Verification

When `WEBHOOK_SECRET` is configured, the service will verify webhook signatures using HMAC-SHA256:

```typescript
// Alchemy sends signature in 'x-alchemy-signature' header
const signature = req.headers['x-alchemy-signature'];
const payload = JSON.stringify(req.body);

// Service verifies using configured secret
const expectedSignature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(payload)
  .digest('hex');
```

### Best Practices
- Always use HTTPS in production
- Set a strong webhook secret
- Monitor webhook endpoint logs
- Validate payload structure

## Testing

### Test Script
Use the included test script to verify webhook functionality:

```bash
# Install axios if not already available
npm install axios

# Run test with default values
node webhook-test.js

# Run test with specific addresses
node webhook-test.js 0x1234...planner 0x5678...usdc
```

### Manual Testing
You can also test the webhook endpoint manually using curl:

```bash
curl -X POST http://localhost:3001/webhook/alchemy \\
  -H "Content-Type: application/json" \\
  -d '{
    "webhookId": "test123",
    "type": "ADDRESS_ACTIVITY",
    "event": {
      "activity": [
        {
          "fromAddress": "0x...",
          "toAddress": "0x...planner-contract",
          "category": "token",
          "rawContract": {
            "address": "0x...usdc-address",
            "decimal": 6
          }
        }
      ]
    }
  }'
```

## Monitoring

### Logs
The service logs webhook activity:
- Webhook signature verification
- Address activity processing
- Deposit event detection
- Error handling

### Health Check
The `/health` endpoint includes webhook status when enabled:

```json
{
  "status": "ok",
  "services": {
    "eventMonitor": "running",
    "webhook": "enabled"
  }
}
```

## Migration from WebSocket

To migrate from WebSocket to webhook monitoring:

1. Set up Alchemy webhook (see above)
2. Add webhook configuration to environment
3. Restart the service
4. Verify webhook is receiving events
5. Optional: Remove WebSocket configuration

The service will automatically prefer webhooks when `WEBHOOK_ENABLED=true`.

## Troubleshooting

### Common Issues

1. **Webhook not receiving events**
   - Check webhook URL is publicly accessible
   - Verify addresses are correctly added to webhook
   - Check webhook is active in Alchemy dashboard

2. **Signature verification failing**
   - Ensure `WEBHOOK_SECRET` matches Alchemy configuration
   - Check signature header format (`x-alchemy-signature`)

3. **Deposits not being processed**
   - Verify contract addresses match configuration
   - Check token addresses (USDC/DAI) are correct
   - Review logs for processing errors

### Debug Mode
Enable debug logging to see detailed webhook processing:

```bash
LOG_LEVEL=debug node src/index.js
```