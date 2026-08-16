"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Trash2, UploadCloud } from "lucide-react";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function WarehouseImagePicker({
  files,
  onChange,
  existingCount = 0,
  disabled = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  existingCount?: number;
  disabled?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const remainingSlots = Math.max(0, 8 - existingCount - files.length);
  const previews = useMemo(
    () => files.map(file => ({ file, url: URL.createObjectURL(file) })),
    [files]
  );

  useEffect(
    () => () => {
      previews.forEach(preview => URL.revokeObjectURL(preview.url));
    },
    [previews]
  );

  const addFiles = (selected: File[]) => {
    const unsupported = selected.find(
      file => !ALLOWED_IMAGE_TYPES.includes(file.type)
    );
    if (unsupported) {
      setError("Use JPEG, PNG, or WebP images only.");
      return;
    }

    const tooLarge = selected.find(file => file.size > MAX_FILE_SIZE);
    if (tooLarge) {
      setError(`${tooLarge.name} is larger than 5 MB.`);
      return;
    }

    const uniqueFiles = selected.filter(
      candidate =>
        !files.some(
          file =>
            file.name === candidate.name &&
            file.size === candidate.size &&
            file.lastModified === candidate.lastModified
        )
    );

    if (uniqueFiles.length === 0) {
      setError("Those images are already selected.");
      return;
    }

    if (uniqueFiles.length > remainingSlots) {
      setError(
        `You can add ${remainingSlots} more image${remainingSlots === 1 ? "" : "s"}.`
      );
      return;
    }

    setError(null);
    onChange([...files, ...uniqueFiles]);
  };

  const selectFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  return (
    <div className="space-y-3">
      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {previews.map(({ file, url }, index) => (
            <div
              key={`${file.name}-${file.lastModified}-${index}`}
              className="group relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted"
            >
              <Image
                src={url}
                alt={`Selected warehouse image ${index + 1}`}
                fill
                unoptimized
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover"
              />
              <button
                type="button"
                onClick={() =>
                  onChange(files.filter((_, fileIndex) => fileIndex !== index))
                }
                disabled={disabled}
                className="absolute right-2 top-2 inline-flex size-9 items-center justify-center rounded-lg bg-foreground/80 text-background shadow-sm outline-none transition-colors hover:bg-foreground focus-visible:ring-2 focus-visible:ring-background/70 disabled:opacity-50"
                aria-label={`Remove ${file.name}`}
              >
                <Trash2 className="size-4" />
              </button>
              <p className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-6 text-xs text-white">
                {file.name}
              </p>
            </div>
          ))}
        </div>
      )}

      {remainingSlots > 0 && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragEnter={event => {
            event.preventDefault();
            if (!disabled) setIsDragging(true);
          }}
          onDragOver={event => event.preventDefault()}
          onDragLeave={event => {
            event.preventDefault();
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            ) {
              setIsDragging(false);
            }
          }}
          onDrop={event => {
            event.preventDefault();
            setIsDragging(false);
            if (!disabled) addFiles(Array.from(event.dataTransfer.files));
          }}
          aria-controls={inputId}
          className={`flex min-h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center outline-none transition-[background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 ${
            isDragging
              ? "border-primary bg-accent/60 ring-2 ring-primary/15"
              : "border-input bg-surface-subtle hover:border-primary/40 hover:bg-accent/40"
          }`}
        >
          <span className="mb-2 flex size-9 items-center justify-center rounded-lg bg-surface text-primary shadow-sm ring-1 ring-border">
            {files.length ? (
              <ImagePlus className="size-4" />
            ) : (
              <UploadCloud className="size-4" />
            )}
          </span>
          <span className="text-sm font-medium text-foreground">
            {isDragging
              ? "Drop images to add them"
              : "Choose or drop warehouse images"}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            JPEG, PNG or WebP · up to 5 MB each · {remainingSlots} slot
            {remainingSlots === 1 ? "" : "s"} available
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={selectFiles}
        disabled={disabled || remainingSlots === 0}
      />
      {error && (
        <p role="alert" className="text-xs text-error-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
