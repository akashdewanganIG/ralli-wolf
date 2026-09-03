import bcrypt from "bcryptjs";
import { Prisma, PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();
const CONFIRMATION = "CREATE_INITIAL_ADMIN";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function validatePassword(password: string, email: string): void {
  const localPart = email.split("@")[0]?.toLowerCase() || "";
  const strong =
    password.length >= 14 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password) &&
    !password.toLowerCase().includes(localPart);
  if (!strong) {
    throw new Error(
      "BOOTSTRAP_ADMIN_PASSWORD must be at least 14 characters with upper, lower, number and symbol, and must not contain the email local part"
    );
  }
}

async function main(): Promise<void> {
  if (process.env.ALLOW_ADMIN_BOOTSTRAP !== CONFIRMATION) {
    throw new Error(
      `Set ALLOW_ADMIN_BOOTSTRAP=${CONFIRMATION} to acknowledge initial admin creation`
    );
  }

  const email = required("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const firstName = required("BOOTSTRAP_ADMIN_FIRST_NAME");
  const lastName = required("BOOTSTRAP_ADMIN_LAST_NAME");
  const password = required("BOOTSTRAP_ADMIN_PASSWORD");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL is invalid");
  }
  if (firstName.length > 255 || lastName.length > 255) {
    throw new Error("Bootstrap admin names cannot exceed 255 characters");
  }
  validatePassword(password, email);
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(
    async tx => {
      const activeAdmins = await tx.user.count({
        where: { role: UserRole.ADMIN, deletedAt: null },
      });
      if (activeAdmins > 0) {
        throw new Error(
          "An active administrator already exists; create additional users through authenticated user management"
        );
      }
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) {
        throw new Error("A user with BOOTSTRAP_ADMIN_EMAIL already exists");
      }
      return tx.user.create({
        data: {
          email,
          firstName,
          lastName,
          passwordHash,
          role: UserRole.ADMIN,
          mustChangePassword: true,
        },
        select: { id: true },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  console.info(`Initial administrator created with user ID ${user.id}`);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : "Bootstrap failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
