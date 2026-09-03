"use client";

import { useState } from "react";
import Image from "next/image";
import { Image as ImageIcon, Trash2 } from "@repo/ui/icons";
import { ImagePicker } from "./image-picker";

export interface GalleryImage {
  id: number;
  url: string;
  caption?: string | null;
}

/**
 * Presentational gallery for an entity's stored images: existing images with
 * per-image delete, plus the shared picker and an upload action for new ones.
 * Fetching and mutation stay with the calling page, matching how warehouse
 * images are wired.
 */
export function EntityImageGallery({
  images,
  maxImages = 8,
  itemLabel = "images",
  emptyHint = "No photos have been added yet.",
  onUpload,
  onDelete,
  isUploading = false,
  isDeleting = false,
  readOnly = false,
}: {
  images: GalleryImage[];
  maxImages?: number;
  itemLabel?: string;
  emptyHint?: string;
  onUpload: (files: File[]) => unknown;
  onDelete: (imageId: number) => unknown;
  isUploading?: boolean;
  isDeleting?: boolean;
  readOnly?: boolean;
}) {
  const [pending, setPending] = useState<File[]>([]);

  const upload = async () => {
    if (pending.length === 0) return;
    await onUpload(pending);
    setPending([]);
  };

  return (
    <div className="space-y-3">
      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <figure
              key={image.id}
              className="group relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted"
            >
              <Image
                src={image.url}
                alt={image.caption ?? `Photo ${index + 1}`}
                fill
                unoptimized
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover"
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onDelete(image.id)}
                  disabled={isDeleting}
                  className="absolute right-2 top-2 z-10 inline-flex size-9 items-center justify-center rounded-lg bg-foreground/80 text-background shadow-sm outline-none transition-colors hover:bg-foreground focus-visible:ring-2 focus-visible:ring-background/70 disabled:opacity-50"
                  aria-label={`Remove photo ${index + 1}`}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
              {image.caption && (
                <figcaption className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-6 text-xs text-white">
                  {image.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border bg-surface-subtle px-4 py-3 text-sm text-muted-foreground">
          <ImageIcon className="size-5 shrink-0" />
          {emptyHint}
        </div>
      )}

      {!readOnly && images.length < maxImages && (
        <ImagePicker
          files={pending}
          onChange={setPending}
          existingCount={images.length}
          maxImages={maxImages}
          itemLabel={itemLabel}
          disabled={isUploading}
        />
      )}

      {!readOnly && pending.length > 0 && (
        <button
          type="button"
          onClick={upload}
          disabled={isUploading}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
        >
          {isUploading
            ? "Uploading…"
            : `Upload ${pending.length} image${pending.length === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}
