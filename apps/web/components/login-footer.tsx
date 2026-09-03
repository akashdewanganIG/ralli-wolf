"use client";

import Image from "next/image";
import ralliWolfLogo from "../app/assets/images/logos/ralli-wolf-logo.png";
import { ThemeToggle } from "./theme-toggle";

const COLUMNS = [
  {
    heading: "Front office",
    items: ["Leads", "Campaigns", "Opportunities", "Quotes", "Sales orders"],
  },
  {
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

          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
