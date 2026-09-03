"use client";

import * as React from "react";
import Image from "next/image";
import ralliWolfBanner from "../app/assets/images/ralli-wolf-banner.webp";
import ralliWolfBannerV2 from "../app/assets/images/ralli-wolf-banner-v2.webp";
import LoginReviews from "./login-reviews";

const SLIDES = [ralliWolfBanner, ralliWolfBannerV2];

/** How long each slide holds before the crossfade to the next one starts. */
const SLIDE_DURATION = 7000;

export default function LoginShowcase() {
  const [activeSlide, setActiveSlide] = React.useState(0);

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      setActiveSlide(current => (current + 1) % SLIDES.length);
    }, SLIDE_DURATION);

    return () => window.clearInterval(timer);
  }, []);

  // Width follows the height at the banner's own 3:4 ratio (1086 x 1448), so
  // the artwork fills the panel rather than being cropped to fit it.
  return (
    <div className="relative ml-auto hidden h-[calc(100svh-3rem)] min-h-[30rem] w-full max-w-[calc((100svh-3rem)*0.75)] overflow-hidden rounded-2xl border border-[var(--login-border)] bg-[var(--login-panel)] lg:block">
      {SLIDES.map((slide, index) => (
        <Image
          key={slide.src}
          alt=""
          aria-hidden
          className="login-slide object-cover"
          src={slide}
          fill
          sizes="(min-width: 1024px) 50vw, 0px"
          priority={index === 0}
          data-active={index === activeSlide}
        />
      ))}

      <LoginReviews />
    </div>
  );
}
