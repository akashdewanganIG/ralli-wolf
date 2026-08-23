"use client";

import { toast } from "@/lib/toast";

/**
 * Federated sign-in options.
 *
 * These are presented but not yet wired: the API has no OAuth/OIDC routes and
 * no provider credentials are configured, so pressing one says so plainly
 * rather than failing silently or pretending to start a flow that cannot
 * finish. Swap `announce` for the real redirect once a provider exists.
 *
 * The marks are the providers' own logos, inlined as SVG rather than taken
 * from the icon set: a brand mark has to be reproduced in its own colours to
 * be recognisable, and a monochrome stand-in reads as generic. They are
 * multicolour, so they sit correctly on both themes without variants.
 */

/** Google "G", official four-colour mark. */
function GoogleMark() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="size-4 shrink-0"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

/** Microsoft's four-square mark. */
function MicrosoftMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      aria-hidden
      focusable="false"
    >
      <path fill="#F25022" d="M2 2h9.4v9.4H2z" />
      <path fill="#7FBA00" d="M12.6 2H22v9.4h-9.4z" />
      <path fill="#00A4EF" d="M2 12.6h9.4V22H2z" />
      <path fill="#FFB900" d="M12.6 12.6H22V22h-9.4z" />
    </svg>
  );
}

/**
 * SSO is not a company, so there is no logo to reproduce. A neutral key mark
 * carries it, inlined alongside the others so all three render identically.
 */
function SsoMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9" />
      <path d="M17 12v3.5" />
      <path d="M20.5 12v2.5" />
    </svg>
  );
}

const PROVIDERS = [
  { id: "google", label: "Google", Mark: GoogleMark },
  { id: "microsoft", label: "Microsoft", Mark: MicrosoftMark },
  { id: "sso", label: "SSO", Mark: SsoMark },
] as const;

export default function LoginProviders({ disabled }: { disabled?: boolean }) {
  const announce = (label: string) => {
    toast.info(`${label} sign-in is not configured yet`, {
      description:
        "Your administrator needs to connect the provider first. Use your work email and password in the meantime.",
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {PROVIDERS.map(({ id, label, Mark }) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => announce(label)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[var(--login-border)] bg-[var(--login-panel)] text-xs font-medium text-foreground outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Mark />
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--login-border)]" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-[var(--login-border)]" />
      </div>
    </div>
  );
}
