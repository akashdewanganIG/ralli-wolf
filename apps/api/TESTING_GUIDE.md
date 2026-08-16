# Brevo Integration Testing Guide

## Prerequisites

1. **Set up environment variables** in `apps/api/.env`:

   ```env
   BREVO_API_KEY="your-actual-brevo-api-key"
   BREVO_BASE_URL="https://api.brevo.com/v3"
   BREVO_WEBHOOK_SECRET="your-webhook-secret"
   ```

2. **Start the database** (if Docker is available):

   ```bash
   docker-compose up -d
   ```

3. **Run database migration**:

   ```bash
   cd packages/db
   npx prisma migrate dev
   ```

4. **Start the API server**:
   ```bash
   cd apps/api
   npm run dev
   ```

## Testing Steps

### Step 1: Test Brevo Service Directly

Run the test script:

```bash
cd apps/api
node test-brevo.js
```

This will test:

- ✅ API connection
- ✅ Account statistics
- ✅ Campaign retrieval

### Step 2: Test API Endpoints

#### 1. Test Connection

```bash
curl -X GET "http://localhost:4000/api/brevo/test-connection" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 2. Get Campaigns

```bash
curl -X GET "http://localhost:4000/api/brevo/campaigns" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 3. Get Active Campaigns

```bash
curl -X GET "http://localhost:4000/api/brevo/campaigns/active" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 4. Get Analytics

```bash
curl -X GET "http://localhost:4000/api/brevo/analytics" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 5. Sync Leads to Brevo

```bash
curl -X POST "http://localhost:4000/api/brevo/sync-leads" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"leadIds": [1, 2, 3]}'
```

#### 6. Send Campaign

```bash
curl -X POST "http://localhost:4000/api/brevo/send-campaign" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"campaignId": 123, "leadIds": [1, 2]}'
```

### Step 3: Test Webhook (Advanced)

#### 1. Set up webhook in Brevo dashboard:

- URL: `https://your-domain.com/api/brevo/webhooks`
- Events: Select all events (sent, delivered, opened, clicked, bounced, unsubscribed, spam)
- Secret: Set a secret key and add it to `BREVO_WEBHOOK_SECRET`

#### 2. Test webhook locally using ngrok:

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 4000

# Use the ngrok URL in Brevo webhook settings
```

#### 3. Test webhook with sample payload:

```bash
curl -X POST "http://localhost:4000/api/brevo/webhooks" \
  -H "Content-Type: application/json" \
  -H "X-Brevo-Signature: sha256=your-signature" \
  -d '{
    "event": {
      "event": "opened",
      "email": "test@example.com",
      "id": 12345,
      "date": "2023-10-01T10:00:00Z",
      "message-id": "msg_123456"
    }
  }'
```

## Manual Testing Checklist

### ✅ Basic Functionality

- [ ] API connection test passes
- [ ] Can retrieve campaigns from Brevo
- [ ] Can get account statistics
- [ ] Error handling works for invalid API key

### ✅ Lead Synchronization

- [ ] Can sync leads to Brevo (requires database)
- [ ] Handles invalid lead IDs gracefully
- [ ] Updates lead records with Brevo contact ID
- [ ] Returns proper success/failure summary

### ✅ Campaign Management

- [ ] Can retrieve all campaigns
- [ ] Can filter campaigns by status
- [ ] Can get specific campaign details
- [ ] Handles invalid campaign IDs

### ✅ Email Sending

- [ ] Can send campaigns to synced leads
- [ ] Handles leads not synced to Brevo
- [ ] Records campaign member activity
- [ ] Returns proper success/failure summary

### ✅ Webhook Processing

- [ ] Verifies webhook signatures
- [ ] Updates lead scores based on events
- [ ] Stores analytics events
- [ ] Handles invalid signatures gracefully

### ✅ Analytics

- [ ] Returns comprehensive statistics
- [ ] Calculates rates correctly
- [ ] Handles API errors gracefully

## Troubleshooting

### Common Issues:

1. **"BREVO_API_KEY environment variable is required"**
   - Check your `.env` file exists
   - Verify `BREVO_API_KEY` is set correctly

2. **"Brevo API authentication failed"**
   - Verify your API key is correct
   - Check API key permissions in Brevo dashboard

3. **"Cannot reach database server"**
   - Start Docker Desktop
   - Run `docker-compose up -d`

4. **"Lead not found" errors**
   - Ensure you have leads in your database
   - Check lead IDs are valid

5. **Webhook signature verification fails**
   - Verify `BREVO_WEBHOOK_SECRET` matches Brevo settings
   - Check webhook URL is accessible

## Sample Test Data

Create test leads in your database:

```sql
INSERT INTO leads (name, email, phone, company_name, source, score) VALUES
('John Doe', 'john@example.com', '+1234567890', 'Acme Corp', 'Website', 75),
('Jane Smith', 'jane@example.com', '+0987654321', 'Tech Inc', 'Referral', 60),
('Bob Johnson', 'bob@example.com', '+1122334455', 'Startup Co', 'Social Media', 45);
```

## Next Steps After Testing

1. **Set up production environment variables**
2. **Configure webhook in Brevo dashboard**
3. **Test with real campaign data**
4. **Monitor logs for any issues**
5. **Set up monitoring and alerting**
