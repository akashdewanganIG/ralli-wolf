/**
 * Boot-time configuration check.
 *
 * Every value here was previously read at the moment it was needed, which
 * meant a missing one surfaced as a failure in front of a user rather than at
 * deploy: no `RESEND_API_KEY` did not break startup, it broke the next
 * person's sign-in. Checking at boot turns those into a refusal to start,
 * which is the failure a deploy can actually catch.
 */

/** Absent or blank means unset; a variable set to "" is not configured. */
function missing(name: string): boolean {
  return !process.env[name]?.trim();
}

/** Without these the service cannot serve a correct request. */
const REQUIRED: Array<{ name: string; why: string }> = [
  { name: "DATABASE_URL", why: "the database cannot be reached" },
  {
    name: "JWT_SECRET",
    why: "session tokens would be signed with a known fallback, letting anyone forge one",
  },
  {
    name: "RESEND_API_KEY",
    why: "no sign-in code can be delivered, so no user can complete login",
  },
  {
    name: "RESEND_FROM_EMAIL",
    why: "no sign-in code can be delivered, so no user can complete login",
  },
];

/**
 * Degraded but serviceable without these: the feature they belong to fails,
 * the rest of the application does not.
 */
const RECOMMENDED: Array<{ name: string; why: string }> = [
  {
    name: "TOTP_ENCRYPTION_KEY",
    why: "authenticator secrets are encrypted with a key derived from JWT_SECRET, so rotating it unenrols everyone",
  },
  { name: "S3_BUCKET_NAME", why: "file uploads and quote PDFs will fail" },
];

/**
 * Throws when required configuration is absent.
 *
 * Reports every missing variable at once: finding them one restart at a time
 * is the reason config problems take an afternoon instead of a minute.
 */
export function assertRequiredEnvironment(): void {
  for (const { name, why } of RECOMMENDED) {
    if (missing(name)) {
      console.warn(`⚠️  ${name} is not set — ${why}.`);
    }
  }

  const absent = REQUIRED.filter(v => missing(v.name));
  if (absent.length === 0) return;

  const detail = absent.map(v => `  - ${v.name}: ${v.why}`).join("\n");
  throw new Error(
    `Refusing to start: ${absent.length} required environment variable${
      absent.length === 1 ? " is" : "s are"
    } not set.\n${detail}\n\nSee apps/api/env.example for the full list.`
  );
}
