"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "@repo/ui/icons";

import { cn } from "@repo/ui/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

/**
 * The last element focused outside any dialog.
 *
 * Needed because neither obvious hook can see it:
 *
 *   - a render-time capture is wrong, because `DialogContent`'s body also runs
 *     while the dialog is closed (Radix returns null further down), so it
 *     records whatever was focused on an unrelated re-render;
 *   - `onOpenAutoFocus` is too late whenever the dialog contains a field with
 *     `autoFocus`. React applies that during commit, before Radix's effect
 *     fires, so `document.activeElement` is already an input inside the dialog.
 *
 * A capture-phase `focusin` listener sidesteps both: it records focus as it
 * moves, and skips anything inside a dialog, so what it holds when a dialog
 * opens is exactly the control the user came from.
 */
let lastFocusOutsideDialog: HTMLElement | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "focusin",
    event => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target !== document.body &&
        !target.closest('[role="dialog"]')
      ) {
        lastFocusOutsideDialog = target;
      }
    },
    true
  );
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // `bg-overlay`, never `bg-foreground/…`: in dark mode --foreground is
      // #fafafa, so the old rule painted a white wash over the page instead of
      // dimming it. The scrim token darkens in both themes by definition.
      "fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Hide the corner close button for dialogs the user must not dismiss. */
    showCloseButton?: boolean;
  }
>(({ className, children, showCloseButton = true, ...props }, ref) => {
  /**
   * Where focus goes when the dialog closes.
   *
   * Radix restores focus to its own `DialogTrigger`, but most dialogs here are
   * controlled by a boolean and have no trigger element for it to find — so
   * closing one dropped focus onto `<body>` and a keyboard user lost their
   * place in the page. Capturing the previously focused element on mount
   * covers both cases: with a trigger it is the trigger, without one it is
   * whatever the user was actually on.
   */
  const restoreFocusTo = React.useRef<HTMLElement | null>(null);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        onCloseAutoFocus={event => {
          props.onCloseAutoFocus?.(event);
          if (event.defaultPrevented) return;
          const target = restoreFocusTo.current ?? lastFocusOutsideDialog;
          // Only if it is still in the document — the dialog may have removed
          // the very row whose button opened it.
          if (target && document.contains(target)) {
            event.preventDefault();
            target.focus({ preventScroll: true });
          }
        }}
        className={cn(
          // Centred with pinned edges and auto margins on both axes, so the
          // panel sits in the middle without a transform. The enter/exit
          // animation is a fade only — the previous slide and zoom were
          // transform-driven.
          "fixed inset-0 z-50 m-auto grid h-fit max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-lg gap-4 overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-lg shadow-black/10 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close className="absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-[background-color,color] duration-150 hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none">
            <X className="size-3.5" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col gap-1 pr-8 text-left", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Divider above the actions, edge to edge, so the footer reads as a
      // separate region at any dialog width.
      "-mx-4 -mb-4 mt-1 flex flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-sm font-semibold leading-5 tracking-tight text-foreground",
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-xs leading-4 text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
