# WhatsApp Campaign Media Upload - S3 Setup

## Overview

WhatsApp campaign media (images, videos, documents) are now automatically uploaded to AWS S3 when users upload files in the campaign modal. The S3 URL is then used in the campaign message.

## Features

✅ **Automatic S3 Upload** - Files are uploaded to S3 with public read access
✅ **File Size Validation** - Maximum 10MB per file
✅ **File Type Validation** - Images (JPEG, PNG, WebP), Videos (MP4, 3GPP), Documents (PDF, DOC, DOCX)
✅ **Organized Storage** - All campaign media stored in `whatsapp-campaign/` folder
✅ **Public URLs** - Files are accessible via public S3 URLs for MSG91 to fetch

## Setup Instructions

### 1. Create an S3 Bucket

**AWS Console:**

1. Go to [AWS S3 Console](https://console.aws.amazon.com/s3/)
2. Click "Create bucket"
3. **Bucket name**: Choose a unique name (e.g., `your-company-whatsapp-media`)
4. **Region**: Select your preferred region
5. **Block Public Access**: Uncheck "Block all public access" (we need public read access for campaign media)
6. Click "Create bucket"

### 2. Configure Bucket Policy for Public Read Access

1. Go to your bucket → **Permissions** tab
2. Scroll to **Bucket Policy**
3. Add this policy (replace `YOUR-BUCKET-NAME`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

### 3. Create IAM User with S3 Access

1. Go to [IAM Console](https://console.aws.amazon.com/iam/)
2. Click **Users** → **Add users**
3. User name: `whatsapp-media-uploader`
4. Access type: **Programmatic access**
5. Attach policy: **AmazonS3FullAccess** (or create a custom policy for better security - see below)
6. Download the credentials (Access Key ID and Secret Access Key)

**Custom Policy (Recommended):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:PutObjectAcl", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/whatsapp-campaign/*"
    }
  ]
}
```

### 4. Configure Environment Variables

Add these to your `.env` file:

```bash

AWS_REGION=us-east-1                          # Your bucket's region
S3_BUCKET_NAME=your-bucket-name               # Your bucket name
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE        # From IAM user
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG  # From IAM user





```

### 5. Restart Your Backend

```bash
cd apps/api
npm run dev
```

## Usage

### For End Users

1. **Create a WhatsApp Campaign**
2. **Select a template with media header** (image/video/document)
3. **Upload media:**
   - Click "Upload to S3" button
   - Select file (max 10MB)
   - Wait for upload confirmation
   - The S3 URL is automatically used in the campaign

**OR**

3. **Use existing URL:**
   - Click "Use URL" toggle
   - Enter a publicly accessible URL
   - Continue with campaign

### File Structure in S3

```
whatsapp-campaign/
  ├── media-1234567890-abc123def456.jpg
  ├── media-1234567891-def456ghi789.mp4
  └── media-1234567892-ghi789jkl012.pdf
```

**Naming Format:** `{filename}-{timestamp}-{random}.{ext}`

## Security Considerations

### ✅ Recommended Setup

1. **Bucket Policy** for public read access (files must be publicly accessible for MSG91)
2. **IAM User** with minimal permissions (only S3 upload/delete in whatsapp-campaign folder)
3. **No ACL** if bucket policy handles public access
4. **HTTPS only** - all S3 URLs use HTTPS

### ⚠️ Important Notes

- Files are **publicly accessible** via URL (required for WhatsApp campaigns)
- Don't upload sensitive/private files
- Consider adding lifecycle rules to delete old files
- Monitor S3 costs if usage is high

## Alternative: DigitalOcean Spaces

If using DigitalOcean Spaces instead of AWS S3:

```bash
AWS_REGION=nyc3                                # Space region
S3_BUCKET_NAME=your-space-name
AWS_ACCESS_KEY_ID=your-spaces-access-key
AWS_SECRET_ACCESS_KEY=your-spaces-secret-key
S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
S3_USE_ACL=true
```

## Troubleshooting

### Error: "Missing required S3 env vars"

- Ensure all required environment variables are set
- Restart the backend after updating `.env`

### Error: "S3 upload failed: Access Denied"

- Check IAM user has correct permissions
- Verify bucket policy allows uploads
- Check region matches bucket region

### Error: "File size exceeds maximum"

- WhatsApp has strict limits: Images 5MB, Videos 16MB, Documents 100MB
- Our system limits to 10MB for safety
- Compress large files before uploading

### Files Not Accessible

- Check bucket policy allows public read
- Verify "Block Public Access" is OFF
- Test URL in incognito/private browser

## API Endpoint

**Backend Route:** `POST /api/whatsapp/campaigns/upload-media`

**Request:**

```json
{
  "mediaBase64": "base64-encoded-file-data",
  "mimeType": "image/jpeg",
  "filename": "my-image.jpg"
}
```

**Response:**

```json
{
  "url": "https://your-bucket.s3.amazonaws.com/whatsapp-campaign/my-image-1234567890-abc123.jpg",
  "key": "whatsapp-campaign/my-image-1234567890-abc123.jpg"
}
```

## Cost Estimation

**AWS S3 Pricing (as of 2024, us-east-1):**

- Storage: ~$0.023 per GB/month
- PUT requests: ~$0.005 per 1,000 requests
- GET requests: ~$0.0004 per 1,000 requests
- Data transfer out: First 100GB/month free, then ~$0.09/GB

**Example: 1000 campaigns with 1MB images each**

- Storage: 1GB × $0.023 = $0.023/month
- Upload: 1,000 uploads × $0.000005 = $0.005
- Download: ~5,000 views × $0.0000004 = $0.002
- **Total: ~$0.03/month**

Very affordable for most use cases!
