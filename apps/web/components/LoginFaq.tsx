"use client";

import { useState } from "react";
import { ChevronDown } from "@repo/ui/icons";
import { cn } from "@repo/ui/lib/utils";

/**
 * Frequently asked questions below the sign-in fold.
 *
 * Built as a controlled accordion rather than native `<details>`, because a
 * closed `<details>` is `display: none` and cannot be transitioned. The open
 * panel animates via `grid-template-rows: 0fr -> 1fr`, which interpolates to
 * the content's real height without anyone having to measure it.
 *
 * One panel at a time: opening a row closes whichever was open.
 */
const FAQS = [
  {
    q: "What does Ralli Wolf Operations actually cover?",
    a: "One system from first enquiry to delivered order: leads and campaigns, opportunities, quotes and sales orders, then inventory, materials, BOM, production, purchasing and warehouse. Because it is one system, a quote knows what stock exists and an order knows what it will consume.",
  },
  {
    q: "How does a lead become an order?",
    a: "A lead is captured and assigned to an owner, worked through remarks and activities, then converted to an opportunity. Quotes are prepared against that opportunity, sent for approval where the discount requires it, and an accepted quote becomes a sales order that reserves stock.",
  },
  {
    q: "How is stock kept accurate across warehouses?",
    a: "Every change is a posted stock movement rather than an edited number, so on-hand, reserved and available quantities are derived from the ledger. Reorder rules raise alerts per warehouse, and cycle counts reconcile differences without overwriting history.",
  },
  {
    q: "Who can see and change what?",
    a: "Access is role-based, with per-user permissions for anything outside the standard roles. Approvals gate the decisions that need a second pair of eyes, such as discounts beyond the threshold, and every change is written to an audit trail with the user and timestamp.",
  },
] as const;

export default function LoginFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      aria-labelledby="faq-heading"
      className="flex min-h-svh flex-col justify-center pb-20 lg:block lg:min-h-0"
    >
      {/* Deliberately inset further than the rest of the page: the questions
          read as a quieter, narrower column than the sign-in row above. */}
      <div className="mx-auto w-full max-w-[100rem] px-6 sm:px-16 lg:px-32 xl:px-48">
        <div className="pt-14">
          <h2
            id="faq-heading"
            className="text-center font-brand text-xl tracking-tight text-foreground"
          >
            Frequently asked questions
          </h2>

          <div className="mx-auto mt-7 max-w-[44rem]">
            {FAQS.map(({ q, a }, i) => {
              const open = openIndex === i;
              return (
                <div
                  key={q}
                  // Rule between rows only — never above the first or below
                  // the last, so the list is separated rather than boxed.
                  className={cn(
                    i > 0 && "border-t border-[var(--login-border)]"
                  )}
                >
                  <h3>
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`faq-panel-${i}`}
                      id={`faq-trigger-${i}`}
                      onClick={() => setOpenIndex(open ? null : i)}
                      className="flex w-full cursor-pointer items-center justify-between gap-6 py-3.5 text-left text-sm font-medium text-foreground outline-none transition-colors hover:text-primary focus-visible:text-primary"
                    >
                      {q}
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out",
                          open && "rotate-180"
                        )}
                      />
                    </button>
                  </h3>

                  <div
                    id={`faq-panel-${i}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${i}`}
                    className={cn(
                      "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                      open
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    {/* The row collapses to zero height, so the child must be
                        able to be clipped to nothing. */}
                    <div className="overflow-hidden">
                      <p className="w-full pb-4 text-sm leading-relaxed text-text-secondary">
                        {a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
