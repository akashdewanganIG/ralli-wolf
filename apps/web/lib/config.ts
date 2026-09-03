/**
 * Values meaning "call this app's own origin". The rewrite in next.config
 * forwards those requests to the API, which keeps the session cookie
 * same-site when web and API are deployed to separate hosts.
 */
const SAME_ORIGIN = new Set(["/", "same-origin"]);

function resolveApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (configured && SAME_ORIGIN.has(configured)) return "";

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
