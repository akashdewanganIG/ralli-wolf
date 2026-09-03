import {
  deleteImageFromS3,
  extractS3KeyFromUrl,
  uploadImageToS3,
} from "./upload.service.js";
import { DomainError } from "./supplyChain/errors.js";
import { verifyFileContent } from "../utils/file-validation.js";
import { logError } from "../utils/logger.js";

export const ENTITY_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ENTITY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export interface UploadedEntityImage {
  url: string;
  sortOrder: number;
}

/**
 * Verifies and uploads a batch of images for one entity, returning the rows to
 * persist. If any file fails, every image already uploaded in this batch is
 * removed from storage before the error propagates, so a partial failure never
 * leaves orphaned objects behind.
 */
export async function uploadEntityImages(
  files: Express.Multer.File[],
  folder: string,
  namePrefix: string,
  startAt = 0
): Promise<UploadedEntityImage[]> {
  const uploaded: UploadedEntityImage[] = [];

  try {
    for (const [index, file] of files.entries()) {
      const verified = verifyFileContent(
        file.buffer,
        file.mimetype,
        ENTITY_IMAGE_MIME_TYPES
      );
      if (!verified) {
        throw new DomainError(
          "Images must contain valid JPEG, PNG, or WebP data",
          { status: 400, code: "INVALID_IMAGE_CONTENT" }
        );
      }

      const result = await uploadImageToS3(
        file.buffer,
        folder,
        `${namePrefix}-${startAt + index + 1}`,
        verified.mimeType
      );
      uploaded.push({ url: result.secureUrl, sortOrder: startAt + index });
    }
    return uploaded;
  } catch (error) {
    await cleanupEntityImages(uploaded.map(image => image.url));
    throw error;
  }
}

/**
 * Best-effort removal of stored objects. Failures are logged rather than
 * thrown: callers use this while unwinding another error, and an orphaned
 * object must not mask the original failure.
 */
export async function cleanupEntityImages(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map(async url => {
      const key = extractS3KeyFromUrl(url);
      if (!key) return;
      try {
        await deleteImageFromS3(key);
      } catch (error) {
        logError("entity_image_cleanup_failed", error);
      }
    })
  );
}

export function requireImageFiles(
  files: Express.Multer.File[]
): Express.Multer.File[] {
  if (files.length === 0) {
    throw new DomainError("Select at least one image to upload", {
      code: "IMAGE_REQUIRED",
    });
  }
  return files;
}

export function assertImageLimit(
  existingCount: number,
  incomingCount: number,
  limit: number,
  entityLabel: string
): void {
  if (existingCount + incomingCount > limit) {
    throw new DomainError(`A ${entityLabel} can have up to ${limit} images`, {
      status: 400,
      code: "IMAGE_LIMIT_EXCEEDED",
    });
  }
}
