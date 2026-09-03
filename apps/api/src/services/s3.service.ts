import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  type ObjectCannedACL,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";

dotenv.config({ path: "../../.env" });

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

export interface S3UploadResult {
  key: string;

  publicUrl?: string;
}

export interface S3UploadOptions {
  folder?: string;
  filename?: string;
  contentType?: string;
  publicRead?: boolean;
  metadata?: Record<string, string>;
}

function getS3PublicUrl(key: string): string {
  const bucketName = process.env.S3_BUCKET_NAME || "";
  const awsRegion = process.env.AWS_REGION || "";
  const endpointEnv = process.env.S3_ENDPOINT;
  const publicBaseEnv = process.env.S3_PUBLIC_BASE_URL?.trim();

  // Providers such as Supabase Storage and Cloudflare R2 serve public objects
  // from a different host than the S3 API endpoint used to write them, so the
  // public base URL has to be configured independently of S3_ENDPOINT.
  if (publicBaseEnv) {
    const base = publicBaseEnv
      .replace(/{bucket}|\${bucket}/g, bucketName)
      .replace(/\/+$/, "");
    return `${/^https?:\/\//.test(base) ? base : `https://${base}`}/${key}`;
  }

  if (endpointEnv) {
    const scheme = endpointEnv.startsWith("http://") ? "http" : "https";
    const endpoint = endpointEnv.replace(/^https?:\/\//, "").replace(/\/$/, "");

    if (endpoint.includes("{bucket}") || endpoint.includes("${bucket}")) {
      return (
        endpointEnv.replace(/{bucket}|\${bucket}/g, bucketName) + "/" + key
      );
    }

    if (endpoint.includes("digitaloceanspaces.com")) {
      const region = endpoint.split(".")[0];
      return `https://${bucketName}.${region}.digitaloceanspaces.com/${key}`;
    }

    return `${scheme}://${endpoint}/${bucketName}/${key}`;
  }

  return `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${key}`;
}

export function generateS3Key(
  folder: string = "uploads",
  filename: string = "file",
  extension: string = "bin"
): string {
  const sanitizedFolder = folder
    .split("/")
    .map(segment =>
      segment
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
    )
    .filter(Boolean)
    .join("/");
  if (!sanitizedFolder)
    throw new Error("S3 folder must contain a safe segment");
  const sanitizedFilename =
    filename
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "file";
  const sanitizedExtension =
    extension
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 10) || "bin";
  return `${sanitizedFolder}/${sanitizedFilename}-${randomUUID()}.${sanitizedExtension}`;
}

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
      publicRead = false,
      metadata = {},
    } = options;

    let baseFilename = filename || "file";
    let extension = "bin";

    if (baseFilename.includes(".")) {
      const parts = baseFilename.split(".");
      extension = parts[parts.length - 1] || "bin";

      baseFilename = parts.slice(0, -1).join(".") || "file";
    } else if (contentType) {
      const contentTypeMap: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "application/pdf": "pdf",
      };
      extension = contentTypeMap[contentType] || "bin";
    }

    const key = generateS3Key(folder, baseFilename, extension);

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

    const useAcl = process.env.S3_USE_ACL === "true" && publicRead;
    if (useAcl) {
      putObjectParams.ACL = "public-read" as ObjectCannedACL;
    }

    if (Object.keys(metadata).length > 0) {
      putObjectParams.Metadata = metadata;
    }

    const command = new PutObjectCommand(putObjectParams);
    await getS3Client().send(command);

    return {
      key,
      ...(publicRead ? { publicUrl: getS3PublicUrl(key) } : {}),
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown storage error";

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
  } catch (error: unknown) {
    throw new Error(
      `S3 delete failed: ${
        error instanceof Error ? error.message : "Unknown storage error"
      }`
    );
  }
}

export async function getSignedS3DownloadUrl(
  key: string,
  expiresInSeconds = 3_600
): Promise<string> {
  if (
    !key ||
    key.startsWith("/") ||
    key.includes("\\") ||
    key.split("/").includes("..")
  ) {
    throw new Error("Invalid S3 object key");
  }
  if (
    !Number.isSafeInteger(expiresInSeconds) ||
    expiresInSeconds < 60 ||
    expiresInSeconds > 604_800
  ) {
    throw new Error("Signed URL expiry must be between 60 and 604800 seconds");
  }
  const bucketName = process.env.S3_BUCKET_NAME;
  if (!bucketName) throw new Error("Missing required env var: S3_BUCKET_NAME");

  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: bucketName, Key: key }),
    { expiresIn: expiresInSeconds }
  );
}

function isSafeS3Key(key: string): boolean {
  return (
    Boolean(key) &&
    !key.startsWith("/") &&
    !key.includes("\\") &&
    !key.split("/").includes("..")
  );
}

export function extractS3KeyFromUrl(url: string): string | null {
  try {
    const supplied = new URL(url);
    if (supplied.protocol !== "https:" && supplied.protocol !== "http:") {
      return null;
    }
    const marker = "__s3_key_marker__";
    const expected = new URL(getS3PublicUrl(marker));
    const pathPrefix = expected.pathname.slice(0, -marker.length);
    if (
      supplied.origin !== expected.origin ||
      !supplied.pathname.startsWith(pathPrefix)
    ) {
      return null;
    }
    const key = supplied.pathname.slice(pathPrefix.length);
    return isSafeS3Key(key) ? key : null;
  } catch {
    return null;
  }
}

export function extractS3KeyFromReference(reference: string): string | null {
  if (reference.startsWith("s3://")) {
    const key = reference.slice("s3://".length);
    return isSafeS3Key(key) ? key : null;
  }
  return extractS3KeyFromUrl(reference);
}
