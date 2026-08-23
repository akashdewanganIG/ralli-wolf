"use client";

import Image from "next/image";
import Link from "next/link";
import ralliWolfLogo from "../app/assets/images/logos/ralli-wolf-logo.png";

/**
 * Footer for the sign-in page.
 *
 * Two bands. The upper one sets the brand against a summary of what the system
 * covers; the lower one is a single line of small print with the one action a
 * reader down here plausibly still needs — a password reset — held at the
 * opposite end of it.
 *
 * The capability lists are typeset as plain text at secondary weight, not as
 * muted list items: they describe scope, and anything styled like a nav here
 * would promise links a signed-out visitor has no route to.
 *
 * A curved top edge and the change of surface are what separate the footer
 * from the page — the radius matches the showcase panel beside the form, so
 * the two large planes on this page round the same way. The one rule inside it
 * divides the small print from the content, the same way the FAQ above rules
 * between its rows instead of boxing them.
 */
const COLUMNS = [
  {
    heading: "Front office",
    items: ["Leads", "Campaigns", "Opportunities", "Quotes", "Sales orders"],
  },
  {
    // Ordered as the data is entered, matching the supply chain section of the
    // main navigation rather than the alphabet.
    heading: "Supply chain",
    items: [
      "Warehouse",
      "Materials and BOM",
      "Purchasing",
      "Inventory",
      "Production",
    ],
  },
  {
    heading: "Governance",
    items: ["Approvals", "Role-based access", "Audit trail", "Reporting"],
  },
] as const;

export default function LoginFooter() {
  return (
    <footer className="rounded-t-2xl bg-[var(--login-footer)]">
      <div className="mx-auto w-full max-w-[100rem] px-6 sm:px-8 lg:px-10">
        <div className="grid gap-x-10 gap-y-12 pb-12 pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="flex max-w-sm flex-col items-start gap-5">
            <Image
              src={ralliWolfLogo}
              alt="Ralli Wolf"
              width={800}
              height={150}
              className="h-7 w-auto object-contain"
            />
            <p className="text-sm leading-relaxed text-text-secondary">
              One system from first enquiry to delivered order, so a quote knows
              what stock exists and an order knows what it will consume.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
            {COLUMNS.map(({ heading, items }) => (
              <div key={heading}>
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                  {heading}
                </h3>
                <ul className="mt-3 space-y-2">
                  {items.map(item => (
                    <li
                      key={item}
                      className="text-sm leading-snug text-text-secondary"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--login-border)] py-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Innovun Global · Authorized access
            only.
          </p>
          <Link
            href="/forgot-password"
            className="rounded-sm text-xs font-medium text-primary outline-none hover:text-info focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            Reset your password
          </Link>
        </div>
      </div>
    </footer>
  );
}
