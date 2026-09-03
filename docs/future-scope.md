# Future Scope & Post-MVP Features

This document outlines features and improvements that are **not included in the MVP** but are planned for future releases.

---

## CSV Contact Management Improvements

### Current MVP Implementation

In the current MVP, CSV-uploaded contacts work as follows:

- **Transient Storage**: CSV contacts are NOT saved to the Contacts/Leads tables
- **Campaign-Scoped**: Contact data is stored in `CampaignDelivery.csvData` (JSON field)
- **One-Time Use**: Contacts cannot be re-targeted in future campaigns
- **Privacy-First**: No permanent contact storage, GDPR-friendly
- **Webhook Tracking**: Delivery status (sent, delivered, read, failed) is tracked via webhooks

### Data Flow (Current)

```
1. User uploads CSV file
   ↓
2. Frontend parses CSV to JSON (using xlsx library)
   ↓
3. CampaignDelivery records created with:
   - contactId: null (not saved in Contacts table)
   - address: normalized phone number
   - csvData: { name, email, custom_fields... }
   - status: PENDING
   ↓
4. Messages sent via MSG91
   ↓
5. Webhooks update delivery status
   ↓
6. Analytics events logged
```

### CSV Parsing Performance

**Current Implementation:**

- **Location**: Frontend (browser-side parsing)
- **Library**: xlsx (SheetJS)
- **File Size Limit**: 8MB
- **Supported Formats**: CSV, XLSX, XLS

**Performance Characteristics:**

| File Type     | Size Limit | Estimated Rows | Parse Time |
| ------------- | ---------- | -------------- | ---------- |
| CSV           | 8MB        | 50,000-100,000 | 500ms-2s   |
| Excel (.xlsx) | 8MB        | 20,000-50,000  | 1s-4s      |

**Pros:**

- ✅ No server CPU usage
- ✅ Instant feedback to user
- ✅ Server doesn't need CSV parsing libraries

**Cons:**

- ❌ User's browser does all the work (can freeze UI)
- ❌ Large JSON payload sent over network
- ❌ Older devices/browsers struggle with large files
- ❌ No server-side validation until submission

### Where CSV Data is Displayed

**Current UI Locations:**

| Page                       | What's Shown                             | CSV Data Visible? |
| -------------------------- | ---------------------------------------- | ----------------- |
| `/campaigns/whatsapp`      | Campaign name, status, summary stats     | ❌ No             |
| `/campaigns/whatsapp/[id]` | Delivery statistics, template preview    | ❌ No             |
| Deliveries API             | Individual delivery records with csvData | ✅ Yes (API only) |

**Database Storage:**

```typescript

{
  id: 123,
  campaignId: 45,
  contactId: null,  // Not saved in Contacts table
  address: "919876543210",
  status: "DELIVERED",
  csvData: {  // THIS IS STORED
    name: "John Doe",
    email: "john@example.com",
    company: "Acme Corp",
    custom_field_1: "value"
  },
  providerMessageId: "msg91-abc123",
  deliveredAt: "2025-11-29T10:30:00Z",
  readAt: "2025-11-29T10:35:00Z"
}
```

**API Endpoint (Already exists):**

```bash
GET /api/whatsapp/campaigns/deliveries?campaignId=123
```

Returns array with full `csvData` for each delivery.

---

## Post-MVP Feature Proposals

### 1. Add "Save Contacts" Option

**Description**: Allow users to optionally save CSV contacts to the database for future campaigns.

**Implementation:**

```tsx
<Checkbox
  label="Save contacts to database for future campaigns"
  onChange={checked => setSaveContacts(checked)}
/>
```

**Behavior:**

- When checked: Import contacts to Contacts/Leads table
- When unchecked: Keep current transient behavior
- User can choose per-campaign

**Benefits:**

- Flexible: One-off vs recurring campaigns
- Contact history and timeline tracking
- Ability to build segments from imported contacts
- Deduplication across campaigns

**Database Changes:**

```sql
ALTER TABLE CampaignDelivery
ADD COLUMN contactSaved BOOLEAN DEFAULT FALSE;


```

---

### 2. Deliveries Table in Campaign Detail UI

**Description**: Show individual delivery details with CSV contact data in the campaign detail page.

**Current State**: Only aggregate statistics shown (total, delivered, read, failed)

**Proposed UI:**

```tsx
<div className="mt-6">
  <h2 className="text-xl font-semibold mb-4">Delivery Details</h2>

  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Phone Number</TableHead>
        <TableHead>Name (CSV)</TableHead>
        <TableHead>Email (CSV)</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Sent At</TableHead>
        <TableHead>Delivered At</TableHead>
        <TableHead>Read At</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {deliveries.map(delivery => (
        <TableRow key={delivery.id}>
          <TableCell>{delivery.address}</TableCell>
          <TableCell>{delivery.csvData?.name || "-"}</TableCell>
          <TableCell>{delivery.csvData?.email || "-"}</TableCell>
          <TableCell>
            <Badge variant={getStatusVariant(delivery.status)}>
              {delivery.status}
            </Badge>
          </TableCell>
          <TableCell>{formatDateTime(delivery.sentAt)}</TableCell>
          <TableCell>{formatDateTime(delivery.deliveredAt)}</TableCell>
          <TableCell>{formatDateTime(delivery.readAt)}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>

  {/* Pagination for large campaigns */}
  <Pagination
    currentPage={page}
    totalPages={totalPages}
    onPageChange={setPage}
  />
</div>
```

**Features:**

- Pagination for large campaigns (500+ contacts)
- Sortable columns (by status, time, etc.)
- Filterable (show only delivered, failed, etc.)
- Export to CSV/Excel
- Search by phone, name, email

**Benefits:**

- Visibility into individual delivery status
- Debug failed deliveries
- Verify contact data accuracy
- Export for reporting

---

### 3. Upload Campaigns Archive Table

**Description**: Store complete CSV files with campaigns for reference and re-use.

**Database Schema:**

```sql
CREATE TABLE UploadCampaign (
  id SERIAL PRIMARY KEY,
  campaignId INT REFERENCES Campaign(id),
  originalFileName TEXT NOT NULL,
  uploadedAt TIMESTAMP DEFAULT NOW(),
  uploadedBy INT REFERENCES "User"(id),
  contactCount INT NOT NULL,
  csvData JSONB NOT NULL,  -- Full CSV for reference
  fileSize INT,  -- in bytes

  UNIQUE(campaignId)
);

CREATE INDEX idx_upload_campaign_campaign_id ON UploadCampaign(campaignId);
CREATE INDEX idx_upload_campaign_uploaded_by ON UploadCampaign(uploadedBy);
```

**Features:**

- Store entire CSV with campaign
- Re-export original file later
- View upload history
- Re-use CSV for similar campaigns

**UI:**

```tsx
<Card className="p-4">
  <h3>Uploaded File</h3>
  <div className="flex items-center gap-4">
    <FileIcon />
    <div>
      <p className="font-medium">{uploadCampaign.originalFileName}</p>
      <p className="text-sm text-muted-foreground">
        {uploadCampaign.contactCount} contacts • Uploaded{" "}
        {formatDate(uploadCampaign.uploadedAt)}
      </p>
    </div>
    <Button variant="outline" size="sm">
      <Download className="h-4 w-4 mr-2" />
      Re-download CSV
    </Button>
  </div>
</Card>
```

**Benefits:**

- Audit trail for uploads
- Doesn't pollute Contacts table
- Can re-create campaign with same data
- Compliance and record-keeping

---

### 4. CSV Column Preview Before Campaign Creation

**Description**: Show preview of CSV data before creating campaign.

**UI Flow:**

```
Step 5: Upload CSV
  ↓
[New Step 5.5: Preview CSV Data]
  ↓
Step 6: Configure Template Variables
```

**Preview Screen:**

```tsx
<Card className="p-4">
  <h3>CSV Preview</h3>

  <div className="space-y-4">
    {/* Column Summary */}
    <div>
      <p className="text-sm font-medium">
        Columns Detected ({csvColumns.length})
      </p>
      <div className="flex flex-wrap gap-2 mt-2">
        {csvColumns.map(col => (
          <Badge key={col} variant="secondary">
            {col}
          </Badge>
        ))}
      </div>
    </div>

    {/* Sample Rows */}
    <div>
      <p className="text-sm font-medium mb-2">
        Sample Data (showing 5 of {csvContacts.length} rows)
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            {csvColumns.map(col => (
              <TableHead key={col}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {csvContacts.slice(0, 5).map((row, idx) => (
            <TableRow key={idx}>
              {csvColumns.map(col => (
                <TableCell key={col}>{row[col] || "-"}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    {/* Validation Issues */}
    {validationIssues.length > 0 && (
      <Alert variant="warning">
        <AlertTitle>Data Issues Found</AlertTitle>
        <AlertDescription>
          <ul className="list-disc pl-5">
            {validationIssues.map((issue, idx) => (
              <li key={idx}>{issue}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    )}
  </div>
</Card>
```

**Validations:**

- Check for missing phone numbers
- Validate phone number formats
- Detect duplicate phone numbers
- Warn about empty required fields
- Show row count and file size

**Benefits:**

- Catch errors before campaign creation
- User confidence in data accuracy
- Reduce failed deliveries
- Better UX

---

### 5. Export Campaign Deliveries with CSV Data

**Description**: Export delivery results including original CSV data.

**Export Formats:**

- CSV
- Excel (.xlsx)
- JSON

**Export Content:**

```csv
Phone Number,Name,Email,Company,Status,Sent At,Delivered At,Read At,Failed Reason
919876543210,John Doe,john@example.com,Acme Corp,delivered,2025-11-29 10:00,2025-11-29 10:02,2025-11-29 10:05,
919876543211,Jane Smith,jane@example.com,Beta Inc,failed,2025-11-29 10:00,,,Invalid phone number
```

**Implementation:**

```typescript
export async function exportCampaignDeliveries(
  campaignId: number,
  format: "csv" | "xlsx" | "json"
) {
  const deliveries = await whatsappService.listDeliveries(campaignId);

  const data = deliveries.map(d => ({
    phone: d.address,
    ...d.csvData, // Spread all CSV columns
    status: d.status,
    sentAt: d.sentAt,
    deliveredAt: d.deliveredAt,
    readAt: d.readAt,
    failedReason: d.errorMessage,
  }));

  if (format === "csv") {
    return generateCSV(data);
  } else if (format === "xlsx") {
    return generateExcel(data);
  } else {
    return JSON.stringify(data, null, 2);
  }
}
```

**UI:**

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button size="sm" variant="outline">
      <Download className="h-4 w-4 mr-2" />
      Export Deliveries
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => exportDeliveries("csv")}>
      Export as CSV
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => exportDeliveries("xlsx")}>
      Export as Excel
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => exportDeliveries("json")}>
      Export as JSON
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Benefits:**

- Complete campaign reporting
- Share results with stakeholders
- Analyze in Excel/BI tools
- Reconciliation with original CSV

---

### 6. Pagination for Large CSV Uploads

**Description**: Handle very large CSV files (50k+ contacts) without freezing the UI.

**Current Limitation:**

- Entire CSV loaded into React state
- Can freeze browser with large files
- Memory issues on older devices

**Proposed Solution:**

**Option A: Server-Side Parsing**

```
User uploads file → Backend parses → Stores in DB → Returns summary
```

**Option B: Web Workers**

```typescript
self.onmessage = async (e: MessageEvent) => {
  const { file } = e.data;

  const reader = new FileReader();
  reader.onload = event => {
    const data = new Uint8Array(event.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const contacts = parseWorkbook(workbook);

    self.postMessage({ contacts, success: true });
  };
  reader.readAsArrayBuffer(file);
};

const worker = new Worker("csv-parser.worker.ts");
worker.postMessage({ file });
worker.onmessage = e => {
  setCsvContacts(e.data.contacts);
  setCsvLoading(false);
};
```

**Option C: Chunked Processing**

```typescript
async function handleLargeCSV(file: File) {
  const CHUNK_SIZE = 1000;
  let offset = 0;

  while (offset < totalRows) {
    const chunk = await parseCSVChunk(file, offset, CHUNK_SIZE);
    setCsvContacts(prev => [...prev, ...chunk]);
    offset += CHUNK_SIZE;

    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
```

**Benefits:**

- Handle 100k+ contacts without freezing
- Better user experience
- Support larger campaigns
- More robust parsing

---

### 7. CSV Template Downloads

**Description**: Provide pre-formatted CSV templates for users.

**Templates:**

1. **Basic Template**

   ```csv
   phone,name,email
   919876543210,John Doe,john@example.com
   ```

2. **WhatsApp Template with Variables**

   ```csv
   phone,name,email,company,offer_code,expiry_date
   919876543210,John Doe,john@example.com,Acme Corp,SAVE20,2025-12-31
   ```

3. **Advanced Template (All Fields)**
   ```csv
   phone,name,firstName,lastName,email,countryCode,city,state,pincode,position,companyName
   919876543210,John Doe,John,Doe,john@example.com,91,Mumbai,Maharashtra,400001,Manager,Acme Corp
   ```

**UI:**

```tsx
<div className="border rounded p-4 bg-muted/50">
  <h4 className="text-sm font-medium mb-2">Need a template?</h4>
  <p className="text-xs text-muted-foreground mb-3">
    Download a CSV template to get started
  </p>
  <div className="flex gap-2">
    <Button
      size="sm"
      variant="outline"
      onClick={() => downloadTemplate("basic")}
    >
      Basic Template
    </Button>
    <Button
      size="sm"
      variant="outline"
      onClick={() => downloadTemplate("advanced")}
    >
      Advanced Template
    </Button>
  </div>
</div>
```

**Benefits:**

- Reduce user errors
- Faster onboarding
- Consistent data format
- Clear field expectations

---

## Summary: MVP vs Post-MVP

| Feature                          | MVP Status      | Post-MVP Priority |
| -------------------------------- | --------------- | ----------------- |
| CSV Upload & Parsing (Frontend)  | ✅ Implemented  | -                 |
| Webhook Status Tracking          | ✅ Implemented  | -                 |
| CSV Data Storage in Deliveries   | ✅ Implemented  | -                 |
| Loading States & Error Handling  | ✅ Implemented  | -                 |
| Save Contacts to Database Option | ❌ Not Included | High              |
| Deliveries Table in UI           | ❌ Not Included | High              |
| CSV Data Preview Before Campaign | ❌ Not Included | Medium            |
| Export Deliveries with CSV Data  | ❌ Not Included | Medium            |
| Upload Campaigns Archive Table   | ❌ Not Included | Low               |
| Web Workers for Large Files      | ❌ Not Included | Low               |
| CSV Template Downloads           | ❌ Not Included | Low               |

---

## Technical Debt & Considerations

### Performance Optimization Needed

1. **Frontend Parsing Limits**: Move to backend for files > 8MB
2. **Memory Management**: Clear CSV data after campaign creation
3. **Network Payload**: Compress JSON before sending to backend
4. **Database Queries**: Add indexes for csvData JSONB queries

### Security Considerations

1. **CSV Injection**: Sanitize CSV cells that start with `=`, `+`, `@`, `-`
2. **File Size Limits**: Enforce strict limits to prevent DoS
3. **Phone Number Validation**: Validate format before accepting
4. **PII Handling**: Implement data retention policies for CSV data

### Scalability Concerns

1. **Large Campaigns**: Current implementation loads all deliveries - add pagination
2. **Concurrent Uploads**: Rate limit CSV uploads per user
3. **Storage Growth**: CampaignDelivery table will grow large - implement archiving
4. **JSONB Performance**: Monitor query performance on csvData field

---

## Related Documentation

- [WhatsApp S3 Setup](./whatsapp-s3-setup.md)
- API Documentation: `/api/whatsapp/campaigns/deliveries`
- Database Schema: `prisma/schema.prisma`
- Webhook Service: `apps/api/src/services/whatsapp/webhook-service.ts`

---

_Last Updated: 2025-11-29_
