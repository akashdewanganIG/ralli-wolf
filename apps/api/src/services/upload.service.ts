import { uploadToS3, deleteFromS3, extractS3KeyFromUrl } from "./s3.service.js";

export interface UploadResult {
  url: string;
  publicId: string;
  secureUrl: string;
}

export async function uploadImageToS3(
  buffer: Buffer,
  folder: string = "products",
  filename?: string,
  mimetype: string = "image/jpeg"
): Promise<UploadResult> {
  const result = await uploadToS3(buffer, {
    folder,
    filename: filename || "image",
    contentType: mimetype || "image/jpeg",
    publicRead: true,
  });
  if (!result.publicUrl) {
    throw new Error("Public image upload did not return a public URL");
  }

  return {
    url: result.publicUrl,
    publicId: result.key,
    secureUrl: result.publicUrl,
  };
}

export async function deleteImageFromS3(key: string): Promise<void> {
  await deleteFromS3(key);
}

export { extractS3KeyFromUrl };
