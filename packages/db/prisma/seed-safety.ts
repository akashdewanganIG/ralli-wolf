const DESTRUCTIVE_CONFIRMATION = "I_UNDERSTAND_THIS_DELETES_DATA";
const DEMO_CONFIRMATION = "I_UNDERSTAND_THIS_CREATES_DEMO_ACCOUNTS";

export function assertDestructiveSeedAllowed(label: string): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${label} is disabled when NODE_ENV=production`);
  }
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== DESTRUCTIVE_CONFIRMATION) {
    throw new Error(
      `${label} deletes business data. Set ALLOW_DESTRUCTIVE_SEED=${DESTRUCTIVE_CONFIRMATION} for this invocation.`
    );
  }
}

export function assertDestructiveDatabaseAllowed(label: string): void {
  assertDestructiveSeedAllowed(label);

  const rawUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error(`${label} requires DIRECT_URL or DATABASE_URL`);
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new Error(`${label} requires a valid database URL`);
  }
  if (!["postgres:", "postgresql:"].includes(target.protocol)) {
    throw new Error(`${label} only supports a PostgreSQL database URL`);
  }

  const database = decodeURIComponent(target.pathname.replace(/^\//, ""));
  if (!target.hostname || !database || database.includes("/")) {
    throw new Error(`${label} could not identify the target database`);
  }

  const expected = `${target.hostname}:${target.port || "5432"}/${database}`;
  if (process.env.DESTRUCTIVE_DATABASE_CONFIRM !== expected) {
    throw new Error(
      `${label} targets ${expected}. Set DESTRUCTIVE_DATABASE_CONFIRM=${expected} for this invocation.`
    );
  }
}

export function requireDemoSeedPassword(): string {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEMO_SEED !== DEMO_CONFIRMATION
  ) {
    throw new Error(
      `Demo accounts are disabled in production. Set ALLOW_DEMO_SEED=${DEMO_CONFIRMATION} only for an explicitly approved demo environment.`
    );
  }
  const password = process.env.DEMO_SEED_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("DEMO_SEED_PASSWORD must contain at least 12 characters");
  }
  return password;
}
