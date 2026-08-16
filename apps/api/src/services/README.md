# File Upload Services

This directory contains file upload services for the application.

## Architecture

### `s3.service.ts` - Generic S3 Service

This is the **core S3 service** that handles all S3 operations. It's file-type agnostic and can be used for:

- Images (JPEG, PNG, GIF, WebP, SVG)
- Documents (PDF, DOC, DOCX)
- Spreadsheets (XLS, XLSX, CSV)
- Any other file type

**Key Features:**

- Generic file upload to S3
- File deletion by key or URL
- URL generation for different S3 providers (AWS, DigitalOcean Spaces, MinIO)
- Automatic extension inference from content type
- Support for public/private files
- Metadata support

### `upload.service.ts` - Image-Specific Service

This is a **convenience wrapper** specifically for images that uses the generic S3 service. It provides:

- Image-specific upload function (`uploadImageToS3`)
- Backward compatibility with existing code
- Legacy Cloudinary functions (for migration)

## Usage Examples

### Uploading Images (Current Implementation)

```typescript
import {
  uploadImageToS3,
  deleteImageFromS3,
  extractS3KeyFromUrl,
} from "./services/upload.service.js";

// Upload image
const result = await uploadImageToS3(
  buffer,
  "products", // folder
  "product-code", // filename (optional)
  "image/jpeg" // mimetype
);

// Delete image by key
await deleteImageFromS3(key);

// Extract key from URL
const key = extractS3KeyFromUrl(url);
```

### Uploading PDFs (Future Implementation)

```typescript
import {
  uploadToS3,
  deleteFromS3,
  deleteFromS3ByUrl,
} from "./services/s3.service.js";

// Upload PDF
const result = await uploadToS3(buffer, {
  folder: "documents",
  filename: "invoice-123",
  contentType: "application/pdf",
  publicRead: false, // PDFs are typically private
  metadata: {
    "uploaded-by": "user-id",
    "document-type": "invoice",
  },
});

// Delete PDF by URL (easier for database-stored URLs)
await deleteFromS3ByUrl(result.publicUrl);
```

### Uploading Other File Types

```typescript
import { uploadToS3 } from "./services/s3.service.js";

// Upload Excel file
const result = await uploadToS3(buffer, {
  folder: "reports",
  filename: "sales-report",
  contentType:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  publicRead: false,
});

// Upload CSV
const result = await uploadToS3(buffer, {
  folder: "exports",
  filename: "customer-list",
  contentType: "text/csv",
  publicRead: false,
});
```

## Environment Variables

Required in `.env`:

```env
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name

# Optional
S3_ENDPOINT=https://custom-endpoint.com  # For DigitalOcean Spaces, MinIO, etc.
S3_FORCE_PATH_STYLE=true                  # For MinIO and some S3-compatible services
S3_USE_ACL=true                           # Enable ACL (requires Block Public Access to allow ACLs)
```

## File Naming Convention

Files are automatically named using the pattern:

```
{folder}/{sanitized-filename}-{timestamp}.{extension}
```

Example:

- `products/product-code-1234567890.jpg`
- `documents/invoice-123-1234567890.pdf`

## Supported File Types

The service automatically infers extensions from content types for:

- **Images**: JPEG, PNG, GIF, WebP, SVG
- **Documents**: PDF, DOC, DOCX
- **Spreadsheets**: XLS, XLSX, CSV
- **Text**: TXT, CSV

For other file types, the extension defaults to `bin` but can be specified in the filename.

## Error Handling

The service provides detailed error messages for common issues:

- Region/endpoint configuration errors
- Access denied errors
- Invalid credentials

## Migration from Cloudinary

The `upload.service.ts` still contains legacy Cloudinary functions for backward compatibility during migration. These can be removed once all images are migrated to S3.
