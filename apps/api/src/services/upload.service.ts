import { Readable } from "stream";
import { v2 as cloudinary } from "cloudinary";
import { uploadToS3, deleteFromS3, extractS3KeyFromUrl } from "./s3.service.js";

/**
 * Upload Result (for backward compatibility)
 */
export interface UploadResult {
  url: string;
  publicId: string;
  secureUrl: string;
}

/**
 * Get file extension from image mimetype
 */
// function getImageExtensionFromMimeType(mimetype: string): string {
//   const mimeToExt: Record<string, string> = {
//     'image/jpeg': 'jpg',
//     'image/jpg': 'jpg',
//     'image/png': 'png',
//     'image/webp': 'webp',
//   };
//   return mimeToExt[mimetype.toLowerCase()] || 'jpg';
// }

/**
 * Upload image buffer to S3
 * This is a convenience function specifically for images that uses the generic S3 service
 *
 * @param buffer - Image buffer to upload
 * @param folder - S3 folder/path (default: 'products')
 * @param filename - Optional filename (will be sanitized)
 * @param mimetype - Image mimetype (default: 'image/jpeg')
 * @returns Upload result with URL and key
 */
export async function uploadImageToS3(
  buffer: Buffer,
  folder: string = "products",
  filename?: string,
  mimetype: string = "image/jpeg"
): Promise<UploadResult> {
  // Upload using generic S3 service
  // The S3 service will automatically infer the extension from contentType
  // and handle filename sanitization
  const result = await uploadToS3(buffer, {
    folder,
    filename: filename || "image",
    contentType: mimetype || "image/jpeg",
    publicRead: true, // Images are typically public
  });

  // Return in the format expected by existing code (backward compatibility)
  return {
    url: result.publicUrl,
    publicId: result.key,
    secureUrl: result.publicUrl,
  };
}

/**
 * Delete image from S3 by key
 * This is a convenience function that uses the generic S3 service
 *
 * @param key - S3 key (path) of the image to delete
 */
export async function deleteImageFromS3(key: string): Promise<void> {
  await deleteFromS3(key);
}

/**
 * Extract S3 key from URL
 * This re-exports the function from s3.service for backward compatibility
 *
 * @param url - S3 URL
 * @returns S3 key or null if URL is not a valid S3 URL
 */
export { extractS3KeyFromUrl };

// Legacy Cloudinary functions (kept for migration script)

// Configure Cloudinary (temporarily kept for migration)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dpyfromn1",
  api_key: process.env.CLOUDINARY_API_KEY || "925798976649717",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

/**
 * Upload image buffer to Cloudinary (legacy - for migration only)
 */
export async function uploadImageToCloudinary(
  buffer: Buffer,
  folder: string = "products",
  filename?: string
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: "image",
        public_id: filename,
        quality: "auto",
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
          return;
        }
        if (!result) {
          reject(new Error("Cloudinary upload returned no result"));
          return;
        }
        resolve({
          url: result.url,
          publicId: result.public_id,
          secureUrl: result.secure_url,
        });
      }
    );

    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null);
    bufferStream.pipe(uploadStream);
  });
}

/**
 * Delete image from Cloudinary (legacy - for migration only)
 */
export async function deleteImageFromCloudinary(
  publicId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, error => {
      if (error) {
        reject(new Error(`Cloudinary delete failed: ${error.message}`));
        return;
      }
      resolve();
    });
  });
}

/**
 * Extract public ID from Cloudinary URL (legacy - for migration only)
 */
export function extractPublicIdFromUrl(url: string): string | null {
  try {
    const parts = url.split("/upload/");
    if (parts.length !== 2) return null;

    const pathPart = parts[1];
    if (!pathPart) return null;

    const pathParts = pathPart.split("/");
    const filename = pathParts[pathParts.length - 1];
    if (!filename) return null;

    const publicId = filename.split(".")[0];
    if (!publicId) return null;

    if (pathParts.length > 1 && pathParts[0] && pathParts[0].match(/^v\d+$/)) {
      return `${pathParts[0]}/${publicId}`;
    }

    return publicId;
  } catch {
    return null;
  }
}
