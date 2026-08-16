"use client";

import { ShieldCheck, Package, Factory, LineChart } from "lucide-react";

export default function BrandPanel() {
  return (
    <aside className="relative hidden min-h-[calc(100svh-1.5rem)] overflow-hidden rounded-2xl bg-[linear-gradient(145deg,#950c14_0%,#e31720_48%,#f51d26_72%,#820711_100%)] px-8 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-12 xl:py-12">
      {/* Subtle background pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-soft-light [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.9)_0_0.65px,transparent_0.8px)] [background-size:4px_4px]"
      />
      {/* Soft glowing orbs instead of hard borders */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 size-[26rem] rounded-full bg-white/[0.04] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-20 size-[32rem] rounded-full bg-black/[0.12] blur-3xl"
      />

      {/* Header - less text, cleaner spacing */}
      <div className="relative z-10 max-w-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          Ralli Wolf Operations
        </p>
        <h2 className="mt-4 text-3xl font-semibold leading-[1.15] tracking-tight xl:text-4xl">
          Precision across every part, process and location.
        </h2>
      </div>

      {/* Bento grid - removed borders, subtle bg, shorter text */}
      <div className="relative z-10 mt-12 grid grid-cols-2 gap-3 xl:grid-cols-3 lg:mt-auto">
        <div className="col-span-2 flex flex-col gap-3 rounded-2xl bg-white/[0.06] p-4 transition-colors hover:bg-white/[0.09]">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white text-[#950c14] shadow-sm">
            <ShieldCheck className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-white">
              Protected operations access
            </p>
            <p className="mt-1 text-sm text-white/60">
              Enterprise-grade security, role-based access, and complete audit
              logging.
            </p>
          </div>
        </div>

        <div className="col-span-1 flex flex-col gap-3 rounded-2xl bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.09]">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-white">
            <Package className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-white">Live Inventory</p>
            <p className="mt-1 text-xs text-white/60">
              Track stock across all locations.
            </p>
          </div>
        </div>

        <div className="col-span-1 flex flex-col gap-3 rounded-2xl bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.09]">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-white">
            <Factory className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-white">Smart Production</p>
            <p className="mt-1 text-xs text-white/60">
              Monitor assembly workflows.
            </p>
          </div>
        </div>

        <div className="col-span-2 flex flex-col gap-3 rounded-2xl bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.09]">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-white">
            <LineChart className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-white">Unified Analytics</p>
            <p className="mt-1 text-sm text-white/60">
              Complete visibility with powerful, customizable reporting.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
