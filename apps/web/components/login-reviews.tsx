"use client";

import { useEffect, useState } from "react";
import { Star } from "@repo/ui/icons";
import { cn } from "@repo/ui/lib/utils";

/**
 * Review slides laid over the foot of the sign-in showcase.
 *
 * PLACEHOLDER COPY. These are illustrative, not real customer quotes, and are
 * attributed to roles rather than to named people or companies precisely so
 * that nothing here reads as a genuine endorsement. Replace `REVIEWS` with
 * approved quotes before this goes in front of customers.
 *
 * The panel is solid, not translucent: the photography behind it crossfades,
 * and only an opaque backing keeps small text reliably legible over whatever
 * happens to be underneath.
 */
const REVIEWS = [
  {
    rating: 5,
    quote:
      "Stock figures finally match the floor. Quotes are priced against what we actually hold, not what a spreadsheet said last week.",
    role: "Operations Manager",
    context: "Manufacturing",
  },
  {
    rating: 5,
    quote:
      "Requisition to goods receipt used to live in email. It is one thread now, and the approvals happen where the work is.",
    role: "Purchasing Lead",
    context: "Supply chain",
  },
  {
    rating: 4,
    quote:
      "Every movement is posted and traceable. When a number looks wrong we can see who changed what, and when.",
    role: "Finance Controller",
    context: "Audit and reporting",
  },
] as const;

const SLIDE_MS = 6000;
const MAX_RATING = 5;

function Rating({ value }: { value: number }) {
  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={`Rated ${value} out of ${MAX_RATING}`}
    >
      {Array.from({ length: MAX_RATING }).map((_, i) => (
        <Star
          key={i}
          aria-hidden
          weight={i < value ? "fill" : "regular"}
          className={cn(
            "size-3",
            i < value ? "text-warning" : "text-text-disabled"
          )}
        />
      ))}
      <span className="ml-1 text-[0.6875rem] font-medium text-muted-foreground">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export default function LoginReviews() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(
      () => setIndex(i => (i + 1) % REVIEWS.length),
      SLIDE_MS
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 sm:p-4">
      <div className="pointer-events-auto rounded-xl border border-border bg-surface p-3.5">
        {/* Slides share one grid cell, so the card is as tall as the longest
            quote and keeps that height through every rotation — no fixed
            minimum to guess at. */}
        <div className="grid">
          {REVIEWS.map((review, i) => (
            <figure
              key={review.quote}
              aria-hidden={i !== index}
              className={cn(
                "col-start-1 row-start-1 transition-[opacity,transform] duration-500 ease-out",
                i === index
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-1.5 opacity-0"
              )}
            >
              <Rating value={review.rating} />
              <blockquote className="mt-1.5 text-[0.8125rem] leading-snug text-foreground">
                “{review.quote}”
              </blockquote>
              <figcaption className="mt-1.5 text-[0.6875rem] text-muted-foreground">
                {review.role} · {review.context}
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-2.5 flex items-center gap-1.5">
          {REVIEWS.map((review, i) => (
            <button
              key={review.quote}
              type="button"
              aria-label={`Show review ${i + 1} of ${REVIEWS.length}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1 rounded-full outline-none transition-[width,background-color] duration-300",
                "focus-visible:ring-2 focus-visible:ring-ring/40",
                i === index
                  ? "w-5 bg-primary"
                  : "w-1.5 bg-border hover:bg-text-disabled"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
