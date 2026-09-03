import { prisma } from "@repo/db";
import { decryptSecret } from "@repo/db/crypto";
import { normalizeProviderBaseUrl } from "./provider-url.js";

const MSG91_CONTROL_BASE_URL = "https://control.msg91.com/api/v5";

export interface Msg91Credentials {
  apiKey: string;
  baseUrl: string;
}

export async function getMsg91BaseUrl(): Promise<string> {
  const baseUrlConfig = await prisma.appConfig.findUnique({
    where: { key: "whatsapp.baseUrl" },
  });
  return normalizeProviderBaseUrl(
    baseUrlConfig?.plainValue || MSG91_CONTROL_BASE_URL,
    "msg91"
  );
}

export async function getMsg91Credentials(): Promise<Msg91Credentials> {
  const credential = await prisma.integrationCredential.findUnique({
    where: { provider: "whatsapp" },
  });

  if (!credential) {
    throw new Error(
      "MSG91 API key not configured. Please configure it in the integration manager."
    );
  }

  const apiKey = decryptSecret(
    credential.encryptedApiKey,
    credential.iv,
    credential.authTag
  );

  return {
    apiKey,
    baseUrl: await getMsg91BaseUrl(),
  };
}
