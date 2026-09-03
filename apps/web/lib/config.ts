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
