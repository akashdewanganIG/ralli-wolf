"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

/**
 * The full-width action that closes out a card.
 *
 * Cards that carry a "View all" / "All orders" style link used to put it in the
 * header, competing with the title for the eye and leaving the card bottom
 * ragged. Here it is the last thing in the card, spanning the content width, so
 * the reading order matches the intent: what this is, what it says, what to do
 * about it.
 *
 * Renders an anchor when given `href` and a button otherwise, so the same
 * component covers navigation and in-place actions without a caller having to
 * pick between two lookalikes.
 */
export function CardActionButton({
  href,
  children,
  className,
  ...props
}: {
  href?: string;
  children: React.ReactNode;
  className?: string;
} & Omit<React.ComponentProps<typeof Button>, "variant" | "size" | "asChild">) {
  const classes = cn("mt-auto", className);

  if (href) {
    return (
      <Button
        asChild
        variant="cardAction"
        size="card"
        className={classes}
        {...props}
      >
        <Link href={href}>{children}</Link>
      </Button>
    );
  }

  return (
    <Button variant="cardAction" size="card" className={classes} {...props}>
      {children}
    </Button>
  );
}
