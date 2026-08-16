import { prisma } from "@repo/db";
import { decryptSecret } from "./crypto.utils.js";

export interface Msg91Credentials {
  apiKey: string;
  baseUrl: string;
}

/**
 * Retrieves MSG91 credentials from the integration config
 * @returns MSG91 API key and base URL
 * @throws Error if credentials are not configured
 */
export async function getMsg91Credentials(): Promise<Msg91Credentials> {
  // Get the WhatsApp API key from integration credentials
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

  // Get the MSG91 base URL from app config
  const baseUrlConfig = await prisma.appConfig.findUnique({
    where: { key: "whatsapp.baseUrl" },
  });

  console.log("Base URL config from DB:", baseUrlConfig);

  const baseUrl =
    baseUrlConfig?.plainValue ||
    process.env.MSG91_BASE_URL ||
    "https://control.msg91.com/api/v5";

  console.log("Final base URL to be used:", baseUrl);

  return {
    apiKey,
    baseUrl,
  };
}
