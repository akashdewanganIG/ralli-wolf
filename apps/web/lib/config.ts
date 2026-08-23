/**
 * Runtime configuration read from the environment.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so a deployed bundle
 * carries whatever was set when it was built — not what is set on the server
 * afterwards.
 */

/**
 * Origin the browser calls the API on.
 *
 * There is deliberately no localhost default. A deployed bundle that fell back
 * to `http://localhost:4000` would have every visitor's browser try to reach a
 * server on their own machine, failing with an opaque network error rather
 * than saying anything useful. An empty value fails loudly instead, and the
 * warning below names the variable to set.
 *
 * Trailing slashes are stripped so callers can append `/api/...` safely.
 */
function resolveApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!configured) {
    if (typeof window !== "undefined") {
      console.error(
        "NEXT_PUBLIC_API_URL is not set. API requests will fail. Set it to the deployed API origin and rebuild — it is inlined at build time."
      );
    }
    return "";
  }

  return configured.replace(/\/+$/, "");
}

export const config = {
  apiUrl: resolveApiUrl(),
} as const;
