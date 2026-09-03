export type ProviderUrlKind = "brevo" | "msg91";

const DEFAULT_ALLOWED_ORIGINS: Record<ProviderUrlKind, readonly string[]> = {
  brevo: ["https://api.brevo.com"],
  msg91: ["https://api.msg91.com", "https://control.msg91.com"],
};

const ADDITIONAL_ORIGINS_ENV: Record<ProviderUrlKind, string> = {
  brevo: "BREVO_ALLOWED_ORIGINS",
  msg91: "MSG91_ALLOWED_ORIGINS",
};

function allowedOrigins(provider: ProviderUrlKind): Set<string> {
  const configured =
    process.env[ADDITIONAL_ORIGINS_ENV[provider]]
      ?.split(",")
      .map(value => value.trim())
      .filter(Boolean) ?? [];
  const origins = [...DEFAULT_ALLOWED_ORIGINS[provider]];
  for (const value of configured) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(
        `${ADDITIONAL_ORIGINS_ENV[provider]} contains an invalid URL`
      );
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        `${ADDITIONAL_ORIGINS_ENV[provider]} must contain HTTPS origins only`
      );
    }
    origins.push(url.origin);
  }
  return new Set(origins);
}

export function assertProviderUrl(
  value: string,
  provider: ProviderUrlKind
): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid ${provider} URL`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(
      `${provider} URL must use HTTPS without embedded credentials`
    );
  }
  if (!allowedOrigins(provider).has(url.origin)) {
    throw new Error(`${provider} URL origin is not approved`);
  }
  return url;
}

export function normalizeProviderBaseUrl(
  value: string,
  provider: ProviderUrlKind
): string {
  const url = assertProviderUrl(value, provider);
  if (url.search || url.hash) {
    throw new Error(`${provider} base URL cannot contain a query or fragment`);
  }
  return url.toString().replace(/\/+$/, "");
}
