import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Export Prisma namespace (types and runtime values like JsonNull/DbNull)
export { Prisma } from "@prisma/client";
// Re-export commonly used enums for convenience across packages
export { UserRole, LeadStatus, LeadSource } from "@prisma/client";
export {
  getDecryptedCredential,
  upsertEncryptedCredential,
  getCredentialMeta,
} from "./integrations.js";
export { getConfigValue, setConfigValue, getConfigMeta } from "./config.js";
