# Brevo CRM Integration Documentation

## Overview

This document describes the Brevo email marketing platform integration with the CRM backend. The integration enables lead synchronization, campaign management, email triggers, webhook event tracking, and analytics retrieval through modular Express.js APIs.

## Architecture

The integration follows a layered architecture:

- **Routes Layer**: Express.js routes with JWT authentication
- **Controller Layer**: Request handling and response formatting
- **Service Layer**: Brevo API integration and business logic
- **Database Layer**: Prisma ORM with PostgreSQL

## Environment Configuration

### Required Environment Variables

Add these variables to your `.env` file:

```env
# Brevo Integration Configuration
BREVO_API_KEY="your-brevo-api-key-here"
BREVO_BASE_URL="https://api.brevo.com/v3"
BREVO_WEBHOOK_SECRET="your-webhook-secret-here"
```

### Getting Brevo API Key

1. Log in to your Brevo account
2. Go to Settings > API Keys
3. Create a new API key with appropriate permissions
4. Copy the key and add it to your environment variables

## Database Schema Changes

### Lead Model Updates

The `Lead` model has been extended with a `brevoContactId` field:

```prisma
model Lead {
  // ... existing fields
  brevoContactId String? @map("brevo_contact_id")
}
```

This field stores the Brevo contact ID for leads that have been synced to Brevo.

## API Endpoints

All endpoints require JWT authentication and `emailMarketing` permission except for webhooks.

### Lead Synchronization

#### POST /api/brevo/sync-leads

Sync selected CRM leads to Brevo contacts.

**Request Body:**

```json
{
  "leadIds": [1, 2, 3, 4, 5]
}
```

**Response:**

```json
{
  "successful": [
    {
      "leadId": 1,
      "brevoContactId": 12345,
      "email": "john@example.com"
    }
  ],
  "failed": [
    {
      "leadId": 2,
      "email": "jane@example.com",
      "error": "Invalid email format"
    }
  ],
  "summary": {
    "total": 5,
    "successful": 4,
    "failed": 1
  }
}
```

### Campaign Management

#### GET /api/brevo/campaigns

Get all campaigns from Brevo.

**Query Parameters:**

- `limit` (optional): Number of campaigns to return (default: 50)
- `offset` (optional): Number of campaigns to skip (default: 0)
- `status` (optional): Filter by campaign status

**Response:**

```json
{
  "campaigns": [
    {
      "id": 123,
      "name": "Welcome Campaign",
      "subject": "Welcome to our service!",
      "type": "classic",
      "status": "sent",
      "createdAt": "2023-10-01T10:00:00Z",
      "statistics": {
        "delivered": 1000,
        "opens": 250,
        "clicks": 50
      }
    }
  ],
  "count": 1,
  "total": 25
}
```

#### GET /api/brevo/campaigns/active

Get only active (sent) campaigns.

#### GET /api/brevo/campaigns/:id

Get specific campaign details by ID.

### Email Sending

#### POST /api/brevo/send-campaign

Send a campaign to selected leads.

**Request Body:**

```json
{
  "campaignId": 123,
  "leadIds": [1, 2, 3]
}
```

**Response:**

```json
{
  "successful": [
    {
      "leadId": 1,
      "email": "john@example.com",
      "messageId": "msg_123456"
    }
  ],
  "failed": [
    {
      "leadId": 2,
      "email": "jane@example.com",
      "error": "Lead not synced to Brevo"
    }
  ],
  "summary": {
    "total": 3,
    "successful": 2,
    "failed": 1
  }
}
```

### Analytics

#### GET /api/brevo/analytics

Get aggregated Brevo statistics.

**Response:**

```json
{
  "totalCampaigns": 25,
  "activeCampaigns": 10,
  "totalSent": 50000,
  "totalDelivered": 49500,
  "totalOpened": 12000,
  "totalClicked": 3000,
  "totalBounced": 500,
  "totalUnsubscribed": 200,
  "totalSpam": 50,
  "deliveryRate": 99.0,
  "openRate": 24.24,
  "clickRate": 6.06,
  "bounceRate": 1.0,
  "unsubscribeRate": 0.4,
  "spamRate": 0.1
}
```

### Connection Test

#### GET /api/brevo/test-connection

Test the Brevo API connection.

**Response:**

```json
{
  "status": "success",
  "message": "Brevo API connection successful"
}
```

## Webhook Integration

### Webhook Endpoint

#### POST /api/brevo/webhooks

Receives Brevo webhook events for engagement tracking.

**Headers:**

- `X-Brevo-Signature`: HMAC-SHA256 signature for verification

**Request Body:**

```json
{
  "event": {
    "event": "opened",
    "email": "john@example.com",
    "id": 12345,
    "date": "2023-10-01T10:00:00Z",
    "message-id": "msg_123456",
    "campaign_id": 789
  }
}
```

### Webhook Setup in Brevo

1. Log in to your Brevo account
2. Go to Settings > Webhooks
3. Create a new webhook with:
   - **URL**: `https://your-domain.com/api/brevo/webhooks`
   - **Events**: Select the events you want to track:
     - `sent` - Email sent
     - `delivered` - Email delivered
     - `opened` - Email opened
     - `clicked` - Link clicked
     - `bounced` - Email bounced
     - `unsubscribed` - User unsubscribed
     - `spam` - Marked as spam
   - **Secret**: Set a secret key and add it to `BREVO_WEBHOOK_SECRET`

## Engagement Scoring

The system automatically updates lead scores based on email engagement events:

| Event                | Score Change | Description                  |
| -------------------- | ------------ | ---------------------------- |
| `email_delivered`    | +2           | Email successfully delivered |
| `email_opened`       | +5           | Email opened by recipient    |
| `email_clicked`      | +10          | Link clicked in email        |
| `email_bounced`      | -5           | Email bounced (hard/soft)    |
| `email_unsubscribed` | -10          | User unsubscribed            |
| `email_spam`         | -15          | Email marked as spam         |

Scores are capped between 0 and 100.

## Error Handling

### Common Error Responses

```json
{
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

### Error Codes

- `400`: Bad Request - Invalid request data
- `401`: Unauthorized - Invalid or missing API key
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource not found
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error - Server error

## Security Considerations

1. **API Key Protection**: Store Brevo API keys securely in environment variables
2. **Webhook Verification**: All webhooks are verified using HMAC-SHA256 signatures
3. **JWT Authentication**: All endpoints require valid JWT tokens
4. **Permission Checks**: Endpoints require `emailMarketing` permission
5. **Rate Limiting**: Built-in handling for Brevo API rate limits

## Testing

### Manual Testing Checklist

1. **Lead Sync**:
   - [ ] Test with valid lead IDs
   - [ ] Test with invalid lead IDs
   - [ ] Verify Brevo contact creation
   - [ ] Check database updates

2. **Campaign Management**:
   - [ ] Fetch all campaigns
   - [ ] Filter by status
   - [ ] Get campaign details
   - [ ] Handle API errors

3. **Email Sending**:
   - [ ] Send to synced leads
   - [ ] Handle unsynced leads
   - [ ] Verify campaign member creation
   - [ ] Check error handling

4. **Webhook Processing**:
   - [ ] Test with valid signature
   - [ ] Test with invalid signature
   - [ ] Verify score updates
   - [ ] Check analytics event creation

5. **Analytics**:
   - [ ] Fetch account statistics
   - [ ] Calculate rates correctly
   - [ ] Handle API errors

### Test Data

Use the following test data for development:

```json
{
  "testLeads": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "companyName": "Acme Corp",
      "source": "Website"
    }
  ],
  "testCampaigns": [
    {
      "id": 123,
      "name": "Welcome Campaign",
      "subject": "Welcome!",
      "status": "sent"
    }
  ]
}
```

## Troubleshooting

### Common Issues

1. **API Connection Failed**
   - Check `BREVO_API_KEY` environment variable
   - Verify API key permissions in Brevo dashboard
   - Check network connectivity

2. **Webhook Signature Verification Failed**
   - Verify `BREVO_WEBHOOK_SECRET` matches Brevo webhook configuration
   - Check webhook URL is accessible
   - Ensure proper HMAC-SHA256 implementation

3. **Lead Sync Failures**
   - Verify lead exists in database
   - Check email format validity
   - Review Brevo API error messages

4. **Campaign Send Failures**
   - Ensure leads are synced to Brevo first
   - Check campaign exists and is active
   - Verify sender email configuration

### Debug Mode

Enable debug logging by setting:

```env
DEBUG=brevo:*
```

This will log all Brevo API requests and responses.

## Performance Considerations

1. **Batch Processing**: Lead sync processes leads individually to handle failures gracefully
2. **Rate Limiting**: Built-in handling for Brevo API rate limits
3. **Timeout Handling**: 30-second timeout for API requests
4. **Error Recovery**: Comprehensive error handling and logging

## Future Enhancements

1. **Template Management**: Direct template creation and management
2. **Advanced Segmentation**: Lead segmentation based on engagement
3. **A/B Testing**: Campaign A/B testing support
4. **Real-time Analytics**: WebSocket-based real-time analytics
5. **Bulk Operations**: Improved bulk lead processing

## Support

For issues related to:

- **Brevo API**: Check [Brevo Developer Documentation](https://developers.brevo.com/docs/getting-started)
- **Integration**: Review this documentation and check logs
- **Database**: Verify Prisma schema and migrations

## Changelog

### Version 1.0.0

- Initial Brevo integration
- Lead synchronization
- Campaign management
- Email sending
- Webhook processing
- Analytics retrieval
- Engagement scoring
