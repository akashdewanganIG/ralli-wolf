"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

/**
 * The shell every "create / edit this record" dialog uses.
 *
 * Entity forms used to be inline panels toggled by a `showForm` flag: the page
 * grew a section, everything below it moved down, and nothing trapped focus or
 * closed on Escape. Routing them all through one dialog gets the modal
 * behaviour from Radix for free — focus trap, focus restored to the trigger on
 * close, Escape, outside-click, and `aria-modal` — and means a new form cannot
 * accidentally invent its own dimensions, padding, or footer.
 *
 * Sizes exist because a three-column form genuinely needs more room than a
 * confirmation, but they only change `max-width`; everything else is shared.
 */
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
  /** Submit control. Wired to `form` by id so it can live in the footer. */
  submitLabel = "Save",
  cancelLabel = "Cancel",
  onSubmit,
  isSubmitting = false,
  submitDisabled = false,
  formId,
  footer,
  className,
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
  /** Supply when the form element is rendered by the caller. */
  formId?: string;
  /** Replaces the default cancel/submit pair entirely. */
  footer?: React.ReactNode;
  className?: string;
}) {
  const generatedId = React.useId();
  const id = formId ?? generatedId;

  const body = onSubmit ? (
    <form id={id} onSubmit={onSubmit} className="grid gap-3">
      {children}
    </form>
  ) : (
    <div className="grid gap-3">{children}</div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(SIZES[size], className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        {body}

        {/* The default footer only appears when this component owns the form.
            Callers that render their own <form> with its own actions keep them,
            rather than ending up with two submit buttons. */}
        {footer !== undefined ? (
          footer
        ) : onSubmit || formId ? (
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
      </DialogContent>
    </Dialog>
  );
}
