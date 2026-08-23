"use client";

import LoginReviews from "./LoginReviews";

/**
 * The video panel beside the sign-in form.
 *
 * Fills its half of the hero outright rather than sitting inside a fixed
 * frame, so the gap to the top, right and bottom edges is whatever the hero's
 * padding is — equal on all three by construction, not by hand-tuned numbers.
 *
 * No shadow: the panel reads as a plane inset into the page rather than a card
 * hovering over it.
 *
 * `aria-hidden` sits on the video alone, not the panel: the footage is
 * decorative, but the reviews layered over it are real content and have to
 * stay reachable.
 *
 * Autoplay is muted, looped and `playsInline` — the only form browsers allow
 * without a gesture — and it falls back to the poster frame if autoplay is
 * refused or the file has not arrived yet.
 */
export default function LoginShowcase() {
  return (
    <div className="relative ml-auto hidden h-[calc(100svh-3rem)] min-h-[30rem] w-full max-w-[calc((100svh-3rem)*0.99)] overflow-hidden rounded-2xl border border-[var(--login-border)] bg-[var(--login-panel)] lg:block">
      <video
        aria-hidden
        className="size-full object-cover"
        src="/login-showcase.mp4"
        poster="/login-showcase-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        tabIndex={-1}
      />

      <LoginReviews />
    </div>
  );
}
