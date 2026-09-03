"use client";

import { useRef, useState } from "react";
import { useSupplierLogo } from "@/hooks/use-entity-images";
import { ItemThumbnail } from "./item-thumbnail";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export function SupplierLogoField({
  supplierId,
  logoUrl,
  supplierName,
}: {
  supplierId: number;
  logoUrl: string | null;
  supplierName: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { upload, remove } = useSupplierLogo(supplierId);
  const busy = upload.isPending || remove.isPending;

  const choose = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED.includes(file.type)) {
      setError("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`${file.name} is larger than 5 MB.`);
      return;
    }
    setError(null);
    upload.mutate(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <ItemThumbnail url={logoUrl} alt={`${supplierName} logo`} size={56} />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
          >
            {upload.isPending
              ? "Uploading…"
              : logoUrl
                ? "Replace logo"
                : "Add logo"}
          </button>
          {logoUrl && (
            <button
              type="button"
              onClick={() => remove.mutate()}
              disabled={busy}
              className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium text-error-foreground outline-none transition-colors hover:bg-error-surface/50 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
            >
              {remove.isPending ? "Removing…" : "Remove"}
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={choose}
        disabled={busy}
      />
      {error && (
        <p role="alert" className="text-xs text-error-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
