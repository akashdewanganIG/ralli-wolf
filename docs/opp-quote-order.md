# Opportunity-Quote-Order Sales Module

This document covers the Opportunity, Quote, and Sales Order sub-modules for the sales pipeline.

---

## Table of Contents

1. [Overview](#overview)
2. [Data Model](#data-model)
3. [Enums](#enums)
   | Opportunity | `OPP-YYMM-XXXX` | OPP-2502-0001 |
   | Quote | `QUO-YYMM-XXXX-V` | QUO-2502-0001-A |
   | Sales Order | `ORD-YYMM-XXXX` | ORD-2502-0001 |

---

## Data Model

### Entity Relationship

```
Account (1) ─────┬────── (N) Opportunity
                 │              │
Contact (1) ─────┤              │
                 │              ├── (N) OpportunityLineItem ── (1) Product
PriceBook (1) ───┘              │
                                ├── (N) OpportunityActivity
                                │
                                └── (N) Quote
                                        │
                                        ├── (N) QuoteLineItem ── (1) Product
                                        │
                                        └── (N) SalesOrder
                                                │
                                                └── (N) SalesOrderLineItem ── (1) Product
```

### Opportunity

Main sales opportunity record.

| Field             | Type              | Description                       |
| ----------------- | ----------------- | --------------------------------- |
| id                | Int               | Primary key (autoincrement)       |
| opportunityNumber | String            | Unique identifier (OPP-YYMM-XXXX) |
| name              | String            | Opportunity name                  |
| description       | String?           | Optional description              |
| stage             | OpportunityStage  | Current pipeline stage            |
| type              | OpportunityType?  | Type of opportunity               |
| status            | OpportunityStatus | Workflow status                   |
| amount            | Decimal?          | Expected deal amount              |
| probability       | Int               | Win probability (0-100%)          |
| expectedCloseDate | DateTime?         | Expected close date               |
| actualCloseDate   | DateTime?         | Actual close date                 |
| leadSource        | String?           | Source of the opportunity         |
| nextStep          | String?           | Next action to take               |
| lossReason        | String?           | Reason if lost                    |
| accountId         | Int               | Related account (required)        |
| contactId         | Int?              | Primary contact                   |
| priceBookId       | Int?              | Price book for pricing            |
| ownerId           | Int               | Owner/sales rep (required)        |
| createdBy         | Int               | Creator user ID                   |
| deletedAt         | DateTime?         | Soft delete timestamp             |
| deletedBy         | Int?              | User who deleted                  |
| createdAt         | DateTime          | Creation timestamp                |
| updatedAt         | DateTime          | Last update timestamp             |

### OpportunityLineItem

Products/services added to an opportunity.

| Field            | Type    | Description                              |
| ---------------- | ------- | ---------------------------------------- |
| id               | Int     | Primary key                              |
| opportunityId    | Int     | Parent opportunity                       |
| productId        | Int     | Product reference                        |
| priceBookEntryId | Int?    | Price book entry for pricing             |
| quantity         | Int     | Quantity (default: 1)                    |
| listPrice        | Decimal | Original list price                      |
| unitPrice        | Decimal | Actual unit price (after adjustments)    |
| discount         | Decimal | Discount percentage (0-100)              |
| totalPrice       | Decimal | Calculated total (quantity \* unitPrice) |
| description      | String? | Line item notes                          |
| sortOrder        | Int     | Display order                            |

### OpportunityActivity

Audit trail and notes for opportunities.

| Field         | Type     | Description                                  |
| ------------- | -------- | -------------------------------------------- |
| id            | Int      | Primary key                                  |
| opportunityId | Int      | Parent opportunity                           |
| userId        | Int      | User who created activity                    |
| activityType  | String   | Type: STAGE_CHANGE, NOTE, FIELD_UPDATE, etc. |
| description   | String   | Activity description                         |
| oldValue      | String?  | Previous value (for changes)                 |
| newValue      | String?  | New value (for changes)                      |
| metadata      | Json?    | Additional structured data                   |
| createdAt     | DateTime | Activity timestamp                           |

### Quote

Quote generated from an opportunity.

| Field                              | Type        | Description                                    |
| ---------------------------------- | ----------- | ---------------------------------------------- |
| id                                 | Int         | Primary key                                    |
| quoteNumber                        | String      | Unique identifier (QUO-YYMM-XXXX-V)            |
| name                               | String      | Quote name                                     |
| description                        | String?     | Optional description                           |
| status                             | QuoteStatus | Workflow status                                |
| type                               | QuoteType   | Quote type                                     |
| version                            | Int         | Version number (1, 2, 3...)                    |
| isPrimary                          | Boolean     | Is this the primary quote?                     |
| subtotal                           | Decimal     | Sum of line items                              |
| discount                           | Decimal     | Total discount amount                          |
| discountPercent                    | Decimal     | Discount as percentage                         |
| taxAmount                          | Decimal     | Tax amount                                     |
| taxPercent                         | Decimal     | Tax percentage                                 |
| shippingAmount                     | Decimal     | Shipping cost                                  |
| grandTotal                         | Decimal     | Final total                                    |
| validUntil                         | DateTime?   | Quote expiration date                          |
| approvedAt                         | DateTime?   | Approval timestamp                             |
| rejectedAt                         | DateTime?   | Rejection timestamp                            |
| presentedAt                        | DateTime?   | Presented to customer timestamp                |
| acceptedAt                         | DateTime?   | Customer acceptance timestamp                  |
| billingName, billingStreet, etc.   | String?     | Billing address fields                         |
| shippingName, shippingStreet, etc. | String?     | Shipping address fields                        |
| paymentTerms                       | String?     | Payment terms                                  |
| deliveryTerms                      | String?     | Delivery terms                                 |
| notes                              | String?     | Customer-facing notes                          |
| internalNotes                      | String?     | Internal notes                                 |
| approvalComment                    | String?     | Comment from approver (approval/denial reason) |
| rejectionComment                   | String?     | Comment when customer rejects quote            |
| opportunityId                      | Int         | Parent opportunity                             |
| accountId                          | Int         | Account reference                              |
| contactId                          | Int?        | Contact reference                              |
| preparedById                       | Int         | User who prepared                              |
| approvedById                       | Int?        | User who approved                              |
| rejectedById                       | Int?        | User who denied (internal rejection)           |

### QuoteLineItem

Products/services on a quote.

| Field            | Type    | Description         |
| ---------------- | ------- | ------------------- |
| id               | Int     | Primary key         |
| quoteId          | Int     | Parent quote        |
| productId        | Int     | Product reference   |
| priceBookEntryId | Int?    | Price book entry    |
| quantity         | Int     | Quantity            |
| listPrice        | Decimal | List price          |
| unitPrice        | Decimal | Unit price          |
| discount         | Decimal | Discount percentage |
| totalPrice       | Decimal | Line total          |
| description      | String? | Line item notes     |
| sortOrder        | Int     | Display order       |

### SalesOrder

Sales order created from an accepted quote.

| Field                           | Type             | Description                       |
| ------------------------------- | ---------------- | --------------------------------- |
| id                              | Int              | Primary key                       |
| orderNumber                     | String           | Unique identifier (ORD-YYMM-XXXX) |
| name                            | String           | Order name                        |
| description                     | String?          | Optional description              |
| status                          | SalesOrderStatus | Order status                      |
| subtotal, discount, etc.        | Decimal          | Pricing (copied from quote)       |
| orderDate                       | DateTime         | Order creation date               |
| expectedShipDate                | DateTime?        | Expected ship date                |
| actualShipDate                  | DateTime?        | Actual ship date                  |
| expectedDeliveryDate            | DateTime?        | Expected delivery                 |
| actualDeliveryDate              | DateTime?        | Actual delivery                   |
| billingName, shippingName, etc. | String?          | Address fields (from quote)       |
| paymentTerms, deliveryTerms     | String?          | Terms (from quote)                |
| notes                           | String?          | Customer notes                    |
| internalNotes                   | String?          | Internal notes                    |
| cancellationReason              | String?          | If cancelled                      |
| quoteId                         | Int              | Source quote                      |
| accountId                       | Int              | Account                           |
| contactId                       | Int?             | Contact                           |
| ownerId                         | Int              | Order owner                       |
| approvedById                    | Int?             | Approver                          |

### SalesOrderLineItem

Products/services on a sales order.

| Field        | Type    | Description   |
| ------------ | ------- | ------------- |
| id           | Int     | Primary key   |
| salesOrderId | Int     | Parent order  |
| productId    | Int     | Product       |
| quantity     | Int     | Quantity      |
| listPrice    | Decimal | List price    |
| unitPrice    | Decimal | Unit price    |
| discount     | Decimal | Discount %    |
| totalPrice   | Decimal | Line total    |
| description  | String? | Notes         |
| sortOrder    | Int     | Display order |

---

## Enums

### OpportunityStage

Pipeline stages with default probability:

| Value             | Description         | Default Probability |
| ----------------- | ------------------- | ------------------- |
| PROSPECT          | Initial stage       | 10%                 |
| QUALIFICATION     | Qualifying the lead | 20%                 |
| DISCOVERY         | Understanding needs | 40%                 |
| VALUE_PROPOSITION | Presenting solution | 60%                 |
| PROPOSAL          | Quote/proposal sent | 75%                 |
| NEGOTIATION       | Negotiating terms   | 90%                 |
| CLOSED_WON        | Deal won            | 100%                |
| CLOSED_LOST       | Deal lost           | 0%                  |

### OpportunityType

| Value                         | Description                 |
| ----------------------------- | --------------------------- |
| NEW_CUSTOMER                  | New customer acquisition    |
| EXISTING_CUSTOMER_UPGRADE     | Upgrading existing customer |
| EXISTING_CUSTOMER_REPLACEMENT | Replacing existing solution |
| EXISTING_CUSTOMER_DOWNGRADE   | Downgrading service         |
| RENEWAL                       | Contract renewal            |

### OpportunityStatus

| Value         | Description              |
| ------------- | ------------------------ |
| DRAFT         | Initial draft state      |
| IN_PROGRESS   | Actively working         |
| SUBMITTED     | Submitted for approval   |
| APPROVED      | Approved to proceed      |
| REJECTED      | Rejected                 |
| QUOTE_CREATED | Quote has been generated |

### QuoteStatus

| Value          | Description           |
| -------------- | --------------------- |
| DRAFT          | Being prepared        |
| IN_REVIEW      | Under internal review |
| NEEDS_REVISION | Requires changes      |
| APPROVED       | Internally approved   |
| DENIED         | Internally denied     |
| PRESENTED      | Presented to customer |
| ACCEPTED       | Customer accepted     |
| REJECTED       | Customer rejected     |

### QuoteType

| Value     | Description           |
| --------- | --------------------- |
| QUOTE     | Standard quote        |
| RENEWAL   | Renewal quote         |
| AMENDMENT | Amendment to existing |
| RE_QUOTE  | Re-quoted version     |

### SalesOrderStatus

| Value            | Description              |
| ---------------- | ------------------------ |
| DRAFT            | Being prepared           |
| PENDING_APPROVAL | Awaiting approval        |
| APPROVED         | Approved for fulfillment |
| IN_FULFILLMENT   | Being fulfilled          |
| SHIPPED          | Shipped to customer      |
| DELIVERED        | Delivered                |
| CANCELLED        | Order cancelled          |
| ON_HOLD          | Order on hold            |

---

## API Endpoints

### Opportunities

Base path: `/api/opportunities`

| Method                               | Endpoint                      | Description                                   | Auth                   |
| ------------------------------------ | ----------------------------- | --------------------------------------------- | ---------------------- |
| GET                                  | `/`                           | List opportunities (paginated, filterable)... | ADMIN and SYSTEM_ADMIN |
| GET                                  | `/:id`                        | Get opportunity with line items...            | ADMIN and SYSTEM_ADMIN |
| POST                                 | `/`                           | Create opportunity...                         | ADMIN and SYSTEM_ADMIN |
| PATCH:                               | `/:id`                        | Update opportunity...                         | ADMIN and SYSTEM_ADMIN |
| DELETE                               | `/:id`                        | Soft delete opportunity...                    | ADMIN and SYSTEM_ADMIN |
| PATCH                                | `/:id/stage`                  | Update stage (logs activity)                  | ADMIN and SYSTEM_ADMIN |
| GET (for future, do not develop it)  | `/:id/activities`             | Get activity history                          | ADMIN and SYSTEM_ADMIN |
| POST (for future, do not develop it) | `/:id/activities`             | Add note/activity                             | ADMIN and SYSTEM_ADMIN |
| GET                                  | `/:id/line-items`             | Get line items...                             | ADMIN and SYSTEM_ADMIN |
| POST                                 | `/:id/line-items`             | Add line item...                              | ADMIN and SYSTEM_ADMIN |
| PATCH                                | `/:id/line-items/:lineItemId` | Update line item...                           | ADMIN and SYSTEM_ADMIN |
| DELETE                               | `/:id/line-items/:lineItemId` | Remove line item...                           | ADMIN and SYSTEM_ADMIN |
| POST                                 | `/:id/generate-quote`         | Generate quote from opportunity...            | ADMIN and SYSTEM_ADMIN |
| GET                                  | `/:id/quotes`                 | Get all quotes for opportunity...             | ADMIN and SYSTEM_ADMIN |
| GET (for future, do not develop it)  | `/pipeline`                   | Pipeline summary by stage                     | ADMIN and SYSTEM_ADMIN |
| GET (for future, do not develop it)  | `/search`                     | Search opportunities                          | ADMIN and SYSTEM_ADMIN |

#### Request/Response Examples

**Create Opportunity**

```http
POST /api/opportunities
Content-Type: application/json

{
  "name": "Enterprise Software Deal",
  "accountId": 123,
  "contactId": 456,
  "priceBookId": 1,
  "type": "NEW_CUSTOMER",
  "amount": 50000,
  "expectedCloseDate": "2025-03-31",
  "leadSource": "Website",
  "nextStep": "Schedule discovery call"
}
```

Response:

```json
{
  "data": {
    "id": 1,
    "opportunityNumber": "OPP-2502-0001",
    "name": "Enterprise Software Deal",
    "stage": "PROSPECT",
    "status": "DRAFT",
    "probability": 10,
    "amount": "50000.00",
    "expectedCloseDate": "2025-03-31T00:00:00.000Z",
    "account": { "id": 123, "name": "Acme Corp" },
    "contact": { "id": 456, "name": "John Doe" },
    "owner": { "id": 1, "firstName": "Sales", "lastName": "Rep" },
    "createdAt": "2025-02-05T10:00:00.000Z"
  }
}
```

**Update Stage**

```http
POST /api/opportunities/1/stage
Content-Type: application/json

{
  "stage": "QUALIFICATION",
  "notes": "Initial call completed, prospect is qualified"
}
```

Response:

```json
{
  "data": {
    "id": 1,
    "stage": "QUALIFICATION",
    "probability": 20,
    "activity": {
      "id": 1,
      "activityType": "STAGE_CHANGE",
      "description": "Stage changed from PROSPECT to QUALIFICATION",
      "oldValue": "PROSPECT",
      "newValue": "QUALIFICATION"
    }
  }
}
```

**Add Line Item**

```http
POST /api/opportunities/1/line-items
Content-Type: application/json

{
  "productId": 10,
  "quantity": 5,
  "unitPrice": 1000,
  "discount": 10
}
```

**Generate Quote**

```http
POST /api/opportunities/1/generate-quote
Content-Type: application/json

{
  "validUntil": "2025-03-15",
  "paymentTerms": "Net 30",
  "notes": "Thank you for your business!"
}
```

Response:

```json
{
  "data": {
    "id": 1,
    "quoteNumber": "QUO-2502-0001-A",
    "status": "DRAFT",
    "isPrimary": true,
    "subtotal": "4500.00",
    "grandTotal": "4500.00",
    "lineItems": [...]
  }
}
```

**Get Opportunity Quotes**

```http
GET /api/opportunities/1/quotes
```

Response:

```json
{
  "data": [
    {
      "id": 1,
      "quoteNumber": "QUO-2502-0001-A",
      "name": "Enterprise Software Deal - Quote",
      "status": "ACCEPTED",
      "version": 1,
      "isPrimary": true,
      "grandTotal": "4500.00",
      "validUntil": "2025-03-15T00:00:00.000Z",
      "preparedBy": { "id": 1, "firstName": "Sales", "lastName": "Rep" },
      "createdAt": "2025-02-05T10:30:00.000Z"
    },
    {
      "id": 2,
      "quoteNumber": "QUO-2502-0001-B",
      "name": "Enterprise Software Deal - Quote (Revised)",
      "status": "DRAFT",
      "version": 2,
      "isPrimary": false,
      "grandTotal": "5000.00",
      "validUntil": "2025-03-20T00:00:00.000Z",
      "preparedBy": { "id": 1, "firstName": "Sales", "lastName": "Rep" },
      "createdAt": "2025-02-06T14:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 2,
    "itemsPerPage": 10,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### Quotes

Base path: `/api/quotes`

| Method                                                  | Endpoint                      | Description                                          | Auth                   |
| ------------------------------------------------------- | ----------------------------- | ---------------------------------------------------- | ---------------------- |
| GET                                                     | `/`                           | List quotes (paginated)...                           | ADMIN and SYSTEM_ADMIN |
| GET                                                     | `/:id`                        | Get quote with line items...                         | ADMIN and SYSTEM_ADMIN |
| PATCH                                                   | `/:id`                        | Update quote(Status)...                              | ADMIN and SYSTEM_ADMIN |
| DELETE (not needed)                                     | `/:id`                        | Delete quote                                         | ADMIN and SYSTEM_ADMIN |
| POST (discussion remaining, dont create this right now) | `/:id/submit`                 | Submit for approval                                  | ADMIN and SYSTEM_ADMIN |
| POST (discussion remaining, dont create this right now) | `/:id/approve`                | Approve quote (with optional comment)                | ADMIN and SYSTEM_ADMIN |
| POST (discussion remaining, dont create this right now) | `/:id/deny`                   | Deny quote internally (with optional comment)        | ADMIN and SYSTEM_ADMIN |
| POST (discussion remaining, dont create this right now) | `/:id/reject`                 | Mark as rejected by customer (with optional comment) | ADMIN and SYSTEM_ADMIN |
| PATCH                                                   | `/:id/set-primary`            | Set as primary quote...                              | ADMIN and SYSTEM_ADMIN |
| GET                                                     | `/:id/line-items`             | Get line items...                                    | ADMIN and SYSTEM_ADMIN |
| POST (not needed)                                       | `/:id/line-items`             | Add line item                                        | ADMIN and SYSTEM_ADMIN |
| PUT (not needed)                                        | `/:id/line-items/:lineItemId` | Update line item                                     | ADMIN and SYSTEM_ADMIN |
| DELETE (not needed)                                     | `/:id/line-items/:lineItemId` | Remove line item                                     | ADMIN and SYSTEM_ADMIN |
| POST                                                    | `/:id/generate-order`         | Generate order from quote                            | ADMIN and SYSTEM_ADMIN |
| GET                                                     | `/:id/orders`                 | Get all orders for quote...                          | ADMIN and SYSTEM_ADMIN |
| POST                                                    | `/:id/clone`                  | Clone quote (new version)                            | ADMIN and SYSTEM_ADMIN |
| GET                                                     | `/:id/pdf`                    | Generate PDF...                                      | ADMIN and SYSTEM_ADMIN |

#### Request/Response Examples

**Submit for Approval**

```http
POST /api/quotes/1/submit
```

Response:

```json
{
  "data": {
    "id": 1,
    "status": "IN_REVIEW"
  }
}
```

**Approve Quote**

```http
POST /api/quotes/1/approve
Content-Type: application/json

{
  "comment": "Approved for customer presentation. Pricing verified."
}
```

Response:

```json
{
  "data": {
    "id": 1,
    "status": "APPROVED",
    "approvedAt": "2025-02-05T14:00:00.000Z",
    "approvedBy": { "id": 2, "firstName": "Admin", "lastName": "User" },
    "approvalComment": "Approved for customer presentation. Pricing verified."
  }
}
```

**Deny Quote (Internal Rejection)**

```http
POST /api/quotes/1/deny
Content-Type: application/json

{
  "comment": "Discount exceeds maximum allowed. Please revise pricing."
}
```

Response:

```json
{
  "data": {
    "id": 1,
    "status": "DENIED",
    "rejectedAt": "2025-02-05T14:00:00.000Z",
    "rejectedBy": { "id": 2, "firstName": "Admin", "lastName": "User" },
    "approvalComment": "Discount exceeds maximum allowed. Please revise pricing."
  }
}
```

**Reject Quote (Customer Rejection)**

```http
POST /api/quotes/1/reject
Content-Type: application/json

{
  "comment": "Customer chose competitor due to longer payment terms."
}
```

Response:

```json
{
  "data": {
    "id": 1,
    "status": "REJECTED",
    "rejectedAt": "2025-02-06T10:00:00.000Z",
    "rejectionComment": "Customer chose competitor due to longer payment terms."
  }
}
```

**Generate Order**

```http
POST /api/quotes/1/generate-order
```

Response:

```json
{
  "data": {
    "id": 1,
    "orderNumber": "ORD-2502-0001",
    "status": "DRAFT",
    "grandTotal": "4500.00",
    "quoteId": 1
  }
}
```

**Get Quote Orders**

```http
GET /api/quotes/1/orders
```

Response:

```json
{
  "data": [
    {
      "id": 1,
      "orderNumber": "ORD-2502-0001",
      "name": "Enterprise Software Deal - Order",
      "status": "APPROVED",
      "grandTotal": "4500.00",
      "orderDate": "2025-02-07T10:00:00.000Z",
      "expectedShipDate": "2025-02-15T00:00:00.000Z",
      "owner": { "id": 1, "firstName": "Sales", "lastName": "Rep" },
      "createdAt": "2025-02-07T10:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 1,
    "itemsPerPage": 10,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### Sales Orders

Base path: `/api/sales-orders`

| Method                                                  | Endpoint          | Description             | Auth                   |
| ------------------------------------------------------- | ----------------- | ----------------------- | ---------------------- |
| GET                                                     | `/`               | List orders (paginated) | ADMIN and SYSTEM_ADMIN |
| GET                                                     | `/:id`            | Get order details...    | ADMIN and SYSTEM_ADMIN |
| PUT (not needed)                                        | `/:id`            | Update order            | ADMIN and SYSTEM_ADMIN |
| POST (discussion remaining, dont create this right now) | `/:id/approve`    | Approve order           | ADMIN and SYSTEM_ADMIN |
| POST (discussion remaining, dont create this right now) | `/:id/cancel`     | Cancel order            | ADMIN and SYSTEM_ADMIN |
| POST (discussion remaining, dont create this right now) | `/:id/ship`       | Mark as shipped         | ADMIN and SYSTEM_ADMIN |
| POST (discussion remaining, dont create this right now) | `/:id/deliver`    | Mark as delivered       | ADMIN and SYSTEM_ADMIN |
| GET                                                     | `/:id/line-items` | Get line items          | ADMIN and SYSTEM_ADMIN |
| GET                                                     | `/:id/pdf`        | Generate PDF...         | ADMIN and SYSTEM_ADMIN |

#### Request/Response Examples

**Approve Order**

```http
POST /api/sales-orders/1/approve
```

**Ship Order**

```http
POST /api/sales-orders/1/ship
Content-Type: application/json

{
  "trackingNumber": "1Z999AA10123456784",
  "carrier": "UPS",
  "expectedDeliveryDate": "2025-02-10"
}
```

**Cancel Order**

```http
POST /api/sales-orders/1/cancel
Content-Type: application/json

{
  "reason": "Customer requested cancellation"
}
```

---

## Business Logic

### Stage Transitions

Valid stage transitions (state machine):

```
PROSPECT -> QUALIFICATION -> DISCOVERY -> VALUE_PROPOSITION -> PROPOSAL -> NEGOTIATION -> CLOSED_WON
                                                                                       -> CLOSED_LOST

Any stage can transition to CLOSED_LOST at any time.
```

### Probability Auto-Update

When stage changes, probability is automatically updated based on stage defaults:

| Stage             | Probability |
| ----------------- | ----------- |
| PROSPECT          | 10%         |
| QUALIFICATION     | 20%         |
| DISCOVERY         | 40%         |
| VALUE_PROPOSITION | 60%         |
| PROPOSAL          | 75%         |
| NEGOTIATION       | 90%         |
| CLOSED_WON        | 100%        |
| CLOSED_LOST       | 0%          |

### Quote Generation Flow

1. Validate opportunity has at least one line item
2. Generate quote number with version suffix (A, B, C...)
3. Copy line items with current pricing snapshot
4. Calculate totals:
   - `subtotal` = sum of line item totals
   - `grandTotal` = subtotal - discount + tax + shipping
5. Set `isPrimary = true` if first quote for opportunity
6. Update opportunity status to `QUOTE_CREATED`
7. Log activity on opportunity

### Order Generation Flow

1. Validate quote:
   - Status must be `ACCEPTED`
   - Must be the primary quote (`isPrimary = true`)
2. Generate order number
3. Copy all quote data including:
   - Line items
   - Pricing totals
   - Address information
   - Terms
4. Set order status to `DRAFT`
5. Update opportunity stage to `CLOSED_WON`
6. Log activity on opportunity

### Access Control

| Role         | Permissions                                                     |
| ------------ | --------------------------------------------------------------- |
| SALES        | View/edit own opportunities only, create quotes, view orders    |
| ADMIN        | Full access to all opportunities, approve quotes, manage orders |
| SYSTEM_ADMIN | Full access                                                     |

---

## Validation Rules

### Opportunity

- `name`: Required, max 255 characters
- `accountId`: Required, must exist
- `ownerId`: Required, must be valid user
- `amount`: Optional, must be positive decimal
- `probability`: 0-100
- `expectedCloseDate`: Optional, must be future date on create

### Line Items

- `productId`: Required, must exist and be active
- `quantity`: Required, minimum 1
- `unitPrice`: Required, positive decimal
- `discount`: 0-100%

### Quote

- Cannot edit after status is `ACCEPTED` or `REJECTED`
- Only `APPROVED` quotes can be presented
- Only `ACCEPTED` primary quotes can generate orders

### Sales Order

- Cannot edit after status is `SHIPPED` or `DELIVERED`
- Cannot cancel after `SHIPPED`

---

## Error Codes

| Code                     | Description                            |
| ------------------------ | -------------------------------------- |
| VALIDATION_ERROR         | Invalid input data                     |
| NOT_FOUND                | Resource not found                     |
| FORBIDDEN                | User does not have permission          |
| CONFLICT                 | Operation conflicts with current state |
| INVALID_STAGE_TRANSITION | Stage transition not allowed           |
| QUOTE_NOT_PRIMARY        | Quote is not the primary quote         |
| QUOTE_NOT_ACCEPTED       | Quote must be accepted first           |
| ORDER_ALREADY_SHIPPED    | Cannot modify shipped order            |
| NO_LINE_ITEMS            | Opportunity has no line items          |

### Error Response Format

```json
{
  "error": "User-friendly message",
  "code": "ERROR_CODE",
  "details": "Technical details (dev mode only)",
  "field": "fieldName"
}
```

---

## Query Parameters

### List Endpoints

All list endpoints support:

| Parameter | Type      | Description                            |
| --------- | --------- | -------------------------------------- |
| page      | number    | Page number (default: 1)               |
| limit     | number    | Items per page (default: 10, max: 100) |
| sortBy    | string    | Field to sort by                       |
| sortOrder | asc\|desc | Sort direction                         |

### Paginated Response Format

All paginated endpoints return responses in this format:

```json
{
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 42,
    "itemsPerPage": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

| Field                      | Type    | Description                         |
| -------------------------- | ------- | ----------------------------------- |
| data                       | array   | Array of items for the current page |
| pagination.currentPage     | number  | Current page number                 |
| pagination.totalPages      | number  | Total number of pages               |
| pagination.totalItems      | number  | Total count of all items            |
| pagination.itemsPerPage    | number  | Number of items per page            |
| pagination.hasNextPage     | boolean | Whether there is a next page        |
| pagination.hasPreviousPage | boolean | Whether there is a previous page    |

### Opportunity Filters

| Parameter         | Type   | Description           |
| ----------------- | ------ | --------------------- |
| stage             | string | Filter by stage       |
| status            | string | Filter by status      |
| ownerId           | number | Filter by owner       |
| accountId         | number | Filter by account     |
| createdFrom       | date   | Created after date    |
| createdTo         | date   | Created before date   |
| expectedCloseFrom | date   | Expected close after  |
| expectedCloseTo   | date   | Expected close before |
| amountMin         | number | Minimum amount        |
| amountMax         | number | Maximum amount        |

### Quote Filters

| Parameter     | Type    | Description           |
| ------------- | ------- | --------------------- |
| status        | string  | Filter by status      |
| opportunityId | number  | Filter by opportunity |
| accountId     | number  | Filter by account     |
| isPrimary     | boolean | Filter primary only   |

### Sales Order Filters

| Parameter | Type   | Description            |
| --------- | ------ | ---------------------- |
| status    | string | Filter by status       |
| quoteId   | number | Filter by source quote |
| accountId | number | Filter by account      |
| ownerId   | number | Filter by owner        |

# Quote Approval Process - Implemented

What was implemented

Database

- ApprovalProcess table — tracks all approvals with: targetObjectName (OPP/QUOTE), status (PENDING/APPROVED/REJECTED), comment,
  targetRecordId, requestedToId (assigned approver), lastActorId, createdById, completedDate
- Quote.pdfUrl — stores the S3 URL after a quote is sent to client
- QuoteStatus cleanup — removed DENIED and NEEDS_REVISION, using REJECTED only

APIs

Method: GET
Endpoint: /api/approvals
Auth: ADMIN+
Description: All approvals in system, filterable by status/type
────────────────────────────────────────
Method: GET
Endpoint: /api/approvals/my
Auth: Any
Description: My approvals (?type=pending_for_me|raised_by_me|all)
────────────────────────────────────────
Method: POST
Endpoint: /api/approvals
Auth: ADMIN+
Description: Manually raise an approval request
────────────────────────────────────────
Method: PATCH
Endpoint: /api/approvals/:id/action
Auth: ADMIN+
Description: Approve or reject with comment (only assigned approver or SYSTEM_ADMIN)
────────────────────────────────────────
Method: POST
Endpoint: /api/opportunities/:id/submit
Auth: ADMIN+
Description: Submits opp; checks OPPORTUNITY_DISCOUNT_THRESHOLD setting
────────────────────────────────────────
Method: POST
Endpoint: /api/quotes/:id/submit-for-approval
Auth: ADMIN+
Description: Puts quote into IN_REVIEW + creates ApprovalProcess
────────────────────────────────────────
Method: POST
Endpoint: /api/quotes/:id/send
Auth: ADMIN+
Description: Generates PDF → S3 → Plunk email with inline summary + download link
────────────────────────────────────────
Method: GET
Endpoint: /api/settings/global-settings
Auth: Any auth
Description: Read settings
────────────────────────────────────────
Method: PUT
Endpoint: /api/settings/global-settings
Auth: SYSTEM_ADMIN only
Description: Update settings (e.g. OPPORTUNITY_DISCOUNT_THRESHOLD)

Email notifications (Plunk, all fire-and-forget)

- Approver notified when a request is raised
- Requester notified when approved or rejected (with comment)
- Client receives quote email with inline line-item summary + S3 PDF download link (CC/BCC supported)

# ❯ how do i setup the s3 and useplunk? in env vars ? also what should be the permission policy ? should I store it in a folder in an existing bucket or should I create a new one ?

● Plunk Setup

1.  Get your API key
    Go to https://useplunk.com → Settings → API Keys → copy the Secret key (starts with sk\_).

2.  Add to .env
    PLUNK_API_KEY="sk_xxxxxxxxxxxxxxxxxxxxxxxx"
    PLUNK_FROM_EMAIL="noreply@yourdomain.com"
    PLUNK_FROM_NAME="Stanley Black & Decker"
    PLUNK_USE_CUSTOM_FROM="true"

Note on PLUNK_USE_CUSTOM_FROM: Set to true only if you've verified a sending domain in Plunk (Settings → Domains). If you haven't verified
a domain, set it to false — Plunk will send from their default address and your PLUNK_FROM_EMAIL is ignored. CC/BCC support depends on your
Plunk plan — test it; if it errors, they may not support it on your tier.

---

S3 Setup

New bucket vs existing — create a new dedicated bucket

Reasons:

- Quote PDFs are client-facing documents — you want separate access policies from WhatsApp media (which may have different retention/access
  needs)
- Easier to set lifecycle rules (auto-expire old PDFs), cost tracking, and access auditing
- Clean separation: one bucket = one purpose

---

Step-by-step: AWS S3

1.  Create the bucket

- AWS Console → S3 → Create bucket
- Name: e.g. innocrm-quotes-prod
- Region: pick closest to your users (e.g. ap-south-1 for India)
- Block all public access: OFF (you want public PDF links)
- Versioning: off (not needed for quotes)

2.  Bucket policy (paste in S3 → Permissions → Bucket Policy)
    {
    "Version": "2012-10-17",
    "Statement": [
    {
    "Sid": "PublicReadQuotes",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::innocrm-quotes-prod/quotes/*"
    }
    ]
    }
    This makes only the quotes/ folder publicly readable — nothing else in the bucket.

3.  Create an IAM user (never use root credentials)

- IAM → Users → Create user → innocrm-api
- Attach this inline policy:
  {
  "Version": "2012-10-17",
  "Statement": [
  {
  "Sid": "QuotePDFWrite",
  "Effect": "Allow",
  "Action": [
  "s3:PutObject",
  "s3:DeleteObject"
  ],
  "Resource": "arn:aws:s3:::innocrm-quotes-prod/quotes/\*"
  }
  ]
  }
- Create access key → copy Access Key ID and Secret Access Key

4.  Add to .env
    AWS_ACCESS_KEY_ID="AKIAXXXXXXXXXXXXXXXX"
    AWS_SECRET_ACCESS_KEY="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    AWS_REGION="ap-south-1"
    S3_BUCKET_NAME="innocrm-quotes-prod"
    S3_USE_ACL="false"

# Leave S3_ENDPOINT blank for standard AWS

Why S3_USE_ACL=false? Modern AWS buckets use bucket policies for public access (what we set above). ACLs are legacy and AWS discourages
them. The bucket policy above is sufficient.

---

If using DigitalOcean Spaces instead

AWS_ACCESS_KEY_ID="your-spaces-key"
AWS_SECRET_ACCESS_KEY="your-spaces-secret"
AWS_REGION="blr1"
S3_BUCKET_NAME="innocrm-quotes-prod"
S3_ENDPOINT="https://blr1.digitaloceanspaces.com"
S3_USE_ACL="true"
DigitalOcean Spaces still uses ACLs for public access, so S3_USE_ACL=true is needed there.

---

Set the discount threshold via API

Once the server is running, call:
PUT /api/settings/global-settings
Authorization: Bearer <system_admin_token>
Content-Type: application/json

{
"key": "OPPORTUNITY_DISCOUNT_THRESHOLD",
"value": "20"
}
This means any opportunity with a line-item discount > 20% will require approval.
