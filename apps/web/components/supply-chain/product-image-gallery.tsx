"use client";

import { useProductImages } from "@/hooks/use-entity-images";
import { EntityImageGallery } from "./entity-image-gallery";

/**
 * Product gallery bound to its own query. Products, materials and inventory
 * items are the same record, so this is the single place their images are
 * managed.
 */
export function ProductImageGallery({
  productId,
  readOnly = false,
}: {
  productId: number;
  readOnly?: boolean;
}) {
  const images = useProductImages(productId);

  return (
    <EntityImageGallery
      images={images.query.data?.data ?? []}
      maxImages={8}
      itemLabel="product images"
      emptyHint="No images have been added for this item yet."
      onUpload={files => images.addImages.mutateAsync(files)}
      onDelete={imageId => images.deleteImage.mutateAsync(imageId)}
      isUploading={images.addImages.isPending}
      isDeleting={images.deleteImage.isPending}
      readOnly={readOnly}
    />
  );
}
