"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

const SIZES = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
} as const;

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "lg",

  submitLabel = "Save",
  cancelLabel = "Cancel",
  onSubmit,
  isSubmitting = false,
  submitDisabled = false,
  formId,
  footer,
  className,
  bodyClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: keyof typeof SIZES;
  submitLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
  submitDisabled?: boolean;

  formId?: string;

  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const generatedId = React.useId();
  const id = formId ?? generatedId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("gap-0 overflow-hidden", SIZES[size], className)}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        {onSubmit ? (
          <form
            id={id}
            onSubmit={onSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <DialogBody>
              <div className={cn("grid gap-3", bodyClassName)}>{children}</div>
            </DialogBody>
            {footer !== undefined ? (
              footer
            ) : (
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  {cancelLabel}
                </Button>
                <Button
                  type="submit"
                  variant="raised"
                  disabled={isSubmitting || submitDisabled}
                >
                  {isSubmitting ? "Saving…" : submitLabel}
                </Button>
              </DialogFooter>
            )}
          </form>
        ) : (
          <>
            <DialogBody>
              <div className={cn("grid gap-3", bodyClassName)}>{children}</div>
            </DialogBody>
            {footer !== undefined ? (
              footer
            ) : formId ? (
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  {cancelLabel}
                </Button>
                <Button
                  type="submit"
                  form={id}
                  variant="raised"
                  disabled={isSubmitting || submitDisabled}
                >
                  {isSubmitting ? "Saving…" : submitLabel}
                </Button>
              </DialogFooter>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
