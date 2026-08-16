import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  type ObjectCannedACL,
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";

// Load environment variables (for scripts that run independently)
// In the app, dotenv is already loaded in app.ts, but this ensures it works in scripts too
dotenv.config({ path: "../../.env" });

// Create S3 client lazily using process.env directly (memoized)
let s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing required S3 env vars: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
    );
  }

  const config: {
    region: string;
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
    };
    endpoint?: string;
    forcePathStyle?: boolean;
  } = {
    region,
    credentials: { accessKeyId, secretAccessKey },
  };

  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint) {
    config.endpoint = endpoint;
    if (process.env.S3_FORCE_PATH_STYLE === "true") {
      config.forcePathStyle = true;
    }
  }

  s3Client = new S3Client(config);
  return s3Client;
}

/**
 * S3 Upload Result
 */
export interface S3UploadResult {
  url: string;
  key: string;
  publicUrl: string;
}

/**
 * S3 Upload Options
 */
export interface S3UploadOptions {
  folder?: string;
  filename?: string;
  contentType?: string;
  publicRead?: boolean;
  metadata?: Record<string, string>;
}

/**
 * Generate S3 public URL from key
 */
export function getS3PublicUrl(key: string): string {
  const bucketName = process.env.S3_BUCKET_NAME || "";
  const awsRegion = process.env.AWS_REGION || "";
  const endpointEnv = process.env.S3_ENDPOINT;

  if (endpointEnv) {
    // Custom endpoint (e.g., DigitalOcean Spaces, MinIO)
    // Handle different endpoint formats
    const endpoint = endpointEnv.replace(/^https?:\/\//, "").replace(/\/$/, "");

    // Check if endpoint already includes bucket name pattern
    if (endpoint.includes("{bucket}") || endpoint.includes("${bucket}")) {
      return (
        endpointEnv.replace(/{bucket}|\${bucket}/g, bucketName) + "/" + key
      );
    }

    // For DigitalOcean Spaces: https://{region}.digitaloceanspaces.com
    // URL format: https://{bucket}.{region}.digitaloceanspaces.com/{key}
    if (endpoint.includes("digitaloceanspaces.com")) {
      const region = endpoint.split(".")[0];
      return `https://${bucketName}.${region}.digitaloceanspaces.com/${key}`;
    }

    // For MinIO or other S3-compatible services
    // URL format: https://{endpoint}/{bucket}/{key}
    return `https://${endpoint}/${bucketName}/${key}`;
  }
  // Standard AWS S3 URL
  return `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${key}`;
}

/**
 * Generate S3 key (path) for file
 */
export function generateS3Key(
  folder: string = "uploads",
  filename: string = "file",
  extension: string = "bin"
): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_]/g, "-");
  return `${folder}/${sanitizedFilename}-${timestamp}.${extension}`;
}

/**
 * Upload file buffer to S3 (generic - works for any file type)
 *
 * @param buffer - File buffer to upload
 * @param options - Upload options (folder, filename, contentType, etc.)
 * @returns S3 upload result with URL and key
 */
export async function uploadToS3(
  buffer: Buffer,
  options: S3UploadOptions = {}
): Promise<S3UploadResult> {
  try {
    const bucketName = process.env.S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error("Missing required env var: S3_BUCKET_NAME");
    }

    const {
      folder = "uploads",
      filename = "file",
      contentType = "application/octet-stream",
      publicRead = true,
      metadata = {},
    } = options;

    // Extract extension and base filename
    let baseFilename = filename || "file";
    let extension = "bin";

    // If filename has an extension, extract it and remove from filename
    if (baseFilename.includes(".")) {
      const parts = baseFilename.split(".");
      extension = parts[parts.length - 1] || "bin";
      // Remove extension from filename (join all parts except the last)
      baseFilename = parts.slice(0, -1).join(".") || "file";
    } else if (contentType) {
      // Try to infer extension from content type
      const contentTypeMap: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "application/pdf": "pdf",
      };
      extension = contentTypeMap[contentType] || "bin";
    }

    // Generate S3 key (filename without extension, extension passed separately)
    const key = generateS3Key(folder, baseFilename, extension);

    // Prepare upload parameters
    const putObjectParams: {
      Bucket: string;
      Key: string;
      Body: Buffer;
      ContentType: string;
      ACL?: ObjectCannedACL;
      Metadata?: Record<string, string>;
    } = {
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    };

    // Set ACL if public read is enabled
    // Note: Only set ACL if explicitly enabled via environment variable
    // If Block Public Access is enabled, you can't use ACL - rely on bucket policy only
    const useAcl = process.env.S3_USE_ACL === "true" && publicRead;
    if (useAcl) {
      putObjectParams.ACL = "public-read" as ObjectCannedACL;
    }

    // Add metadata if provided
    if (Object.keys(metadata).length > 0) {
      putObjectParams.Metadata = metadata;
    }

    // Upload to S3
    const command = new PutObjectCommand(putObjectParams);
    await getS3Client().send(command);

    // Generate public URL
    const publicUrl = getS3PublicUrl(key);

    // Log upload info (can be removed in production)
    console.log(`[S3 Service] ✅ File uploaded successfully`);
    console.log(`[S3 Service] 📍 URL: ${publicUrl}`);
    console.log(`[S3 Service] 🔑 Key: ${key}`);
    console.log(`[S3 Service] 📦 ContentType: ${contentType}`);
    console.log(`[S3 Service] 🪣 Bucket: ${bucketName}`);

    return {
      url: publicUrl,
      key: key,
      publicUrl: publicUrl,
    };
  } catch (error: any) {
    // Provide detailed error messages for common issues
    const errorMessage = error.message || "Unknown error";

    if (
      errorMessage.includes("specified endpoint") ||
      errorMessage.includes("The bucket you are attempting to access") ||
      errorMessage.includes("PermanentRedirect")
    ) {
      const bucketName = process.env.S3_BUCKET_NAME || "";
      const awsRegion = process.env.AWS_REGION || "";
      const endpointEnv = process.env.S3_ENDPOINT || "default (AWS S3)";
      throw new Error(
        `S3 region/endpoint configuration error:\n` +
          `- Bucket: "${bucketName}"\n` +
          `- Configured Region: "${awsRegion}"\n` +
          `- Endpoint: ${endpointEnv}\n\n` +
          `Possible solutions:\n` +
          `1. Verify AWS_REGION in .env matches the bucket's actual region\n` +
          `2. Check S3_BUCKET_NAME is correct\n` +
          `3. If using custom endpoint, verify S3_ENDPOINT is correctly set\n` +
          `4. For MinIO/custom S3, you may need S3_FORCE_PATH_STYLE=true\n\n` +
          `Original error: ${errorMessage}`
      );
    }

    if (
      errorMessage.includes("Access Denied") ||
      errorMessage.includes("403")
    ) {
      const bucketName = process.env.S3_BUCKET_NAME || "";
      throw new Error(
        `S3 access denied. Please verify:\n` +
          `1. AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are correct\n` +
          `2. IAM user has s3:PutObject permission for bucket "${bucketName}"\n` +
          `3. If using ACL, IAM user has s3:PutObjectAcl permission\n\n` +
          `Original error: ${errorMessage}`
      );
    }

    throw new Error(`S3 upload failed: ${errorMessage}`);
  }
}

/**
 * Delete file from S3 by key
 *
 * @param key - S3 key (path) of the file to delete
 */
export async function deleteFromS3(key: string): Promise<void> {
  try {
    const bucketName = process.env.S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error("Missing required env var: S3_BUCKET_NAME");
    }
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await getS3Client().send(command);
    console.log(`[S3 Service] ✅ File deleted: ${key}`);
  } catch (error: any) {
    throw new Error(`S3 delete failed: ${error.message}`);
  }
}

/**
 * Extract S3 key from URL
 *
 * @param url - S3 URL
 * @returns S3 key or null if URL is not a valid S3 URL
 */
export function extractS3KeyFromUrl(url: string): string | null {
  try {
    // Check if it's a Cloudinary URL (for backward compatibility)
    if (url.includes("res.cloudinary.com")) {
      return null;
    }

    // Parse S3 URL
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const bucketName = process.env.S3_BUCKET_NAME || "";
    const endpointEnv = process.env.S3_ENDPOINT;

    // For standard AWS S3 URLs
    // Format: https://{bucket}.s3.{region}.amazonaws.com/{key}
    if (
      urlObj.hostname.includes("s3") &&
      urlObj.hostname.includes("amazonaws.com")
    ) {
      // Extract key from pathname (remove leading slash)
      const key = pathname.substring(1);
      return key || null;
    }

    // For custom endpoints
    if (endpointEnv) {
      const endpoint = endpointEnv
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");

      // For DigitalOcean Spaces: https://{bucket}.{region}.digitaloceanspaces.com/{key}
      if (endpoint.includes("digitaloceanspaces.com")) {
        const key = pathname.substring(1);
        return key || null;
      }

      // For MinIO or other S3-compatible services
      // Format: https://{endpoint}/{bucket}/{key}
      // Check if hostname matches endpoint
      const endpointFirstPart = endpoint.split("/")[0];
      if (endpointFirstPart && urlObj.hostname.includes(endpointFirstPart)) {
        // Remove bucket name from pathname if present
        const pathParts = pathname.split("/").filter(p => p);
        if (pathParts[0] === bucketName) {
          // Bucket name is in path: /{bucket}/{key}
          return pathParts.slice(1).join("/");
        }
        // Bucket name is in hostname: {bucket}.{endpoint}
        return pathname.substring(1);
      }
    }

    // Fallback: try to extract from pathname
    // Remove bucket name if it's the first segment
    if (pathname && pathname.length > 1) {
      const pathParts = pathname.split("/").filter(p => p);
      if (pathParts[0] === bucketName && pathParts.length > 1) {
        return pathParts.slice(1).join("/");
      }
      return pathname.substring(1);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Delete file from S3 by URL
 * Extracts the key from URL and deletes the file
 *
 * @param url - S3 URL of the file to delete
 * @returns true if deleted, false if URL is invalid or not an S3 URL
 */
export async function deleteFromS3ByUrl(url: string): Promise<boolean> {
  const key = extractS3KeyFromUrl(url);
  if (!key) {
    console.warn(`[S3 Service] Cannot extract key from URL: ${url}`);
    return false;
  }

  try {
    await deleteFromS3(key);
    return true;
  } catch (error: any) {
    console.warn(
      `[S3 Service] Failed to delete file from S3: ${error?.message || error}`
    );
    return false;
  }
}

// Export S3 configuration constants for external use if needed
export const S3_CONFIG = {
  bucketName: process.env.S3_BUCKET_NAME,
  region: process.env.AWS_REGION,
  endpoint: process.env.S3_ENDPOINT,
} as const;
