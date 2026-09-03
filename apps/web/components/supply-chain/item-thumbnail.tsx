"use client";

import Image from "next/image";
import { Image as ImageIcon } from "@repo/ui/icons";

/**
 * Small square product thumbnail for list rows. Products, materials and
 * inventory items are the same record, so all three lists render this.
 */
export function ItemThumbnail({
  url,
  alt,
  size = 36,
}: {
  url?: string | null;
  alt: string;
  size?: number;
}) {
  if (!url) {
    return (
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center rounded-md border bg-surface-subtle text-muted-foreground"
        style={{ width: size, height: size }}
      >
        <ImageIcon className="size-4" />
      </span>
    );
  }

  return (
    <span
      className="relative shrink-0 overflow-hidden rounded-md border bg-muted"
      style={{ width: size, height: size }}
    >
      <Image
        src={url}
        alt={alt}
        fill
        unoptimized
        sizes={`${size}px`}
        className="object-cover"
      />
    </span>
  );
}
