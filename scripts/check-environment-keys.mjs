import fs from "node:fs";

const rootKeys = new Map(
  Object.entries({
    NODE_ENV: "development",
    DATABASE_URL:
      "postgresql://postgres:password@localhost:5433/innovun_crm?schema=public",
    JWT_SECRET: "",
    OTP_HASH_SECRET: "",
    TOTP_ENCRYPTION_KEY: "",
    ENCRYPTION_KEY: "",
    RESEND_API_KEY: "",
    RESEND_FROM_EMAIL: "",
    RESEND_REPLY_TO: "",
    PORT: "4000",
    TRUST_PROXY_HOPS: "0",
    CORS_ALLOWED_ORIGINS: "http://localhost:3001",
    FRONTEND_URL: "http://localhost:3001",
    JWT_EXPIRES_IN: "24h",
    KEEPALIVE_TOKEN: "",
    AWS_ACCESS_KEY_ID: "",
    AWS_SECRET_ACCESS_KEY: "",
    AWS_REGION: "ap-south-1",
    S3_BUCKET_NAME: "",
    S3_ENDPOINT: "",
    S3_FORCE_PATH_STYLE: "false",
    S3_USE_ACL: "false",
    MSG91_AUTH_KEY: "",
    MSG91_OTP_TEMPLATE_ID: "",
    MSG91_ALLOWED_ORIGINS: "",
    BREVO_ALLOWED_ORIGINS: "",
    BREVO_WEBHOOK_SECRET: "",
    LANDINGI_WEBHOOK_SECRET: "",
    WHATSAPP_WEBHOOK_SECRET: "",
    GST_API_KEY: "",
    ORDER_PRICE_BOOK_ID: "",
    RUN_EMBEDDED_SCHEDULERS: "false",
    SCHEDULER_INSTANCE_ID: "",
    NEXT_PUBLIC_API_URL: "http://localhost:4000",
    NEXT_PUBLIC_WHATSAPP_TEXT_ONLY_MVP: "false",
    NEXT_PUBLIC_ALLOW_AUTH_TEMPLATES: "false",
    NEXT_PUBLIC_ALLOW_UTILITY_TEMPLATES: "false",
    DIRECT_URL:
      "postgresql://postgres:password@localhost:5433/innovun_crm?schema=public",
    API_URL: "http://localhost:4000",
    ALLOW_DESTRUCTIVE_SEED: "",
    DESTRUCTIVE_DATABASE_CONFIRM: "",
    ALLOW_DEMO_SEED: "",
    DEMO_SEED_PASSWORD: "",
    ALLOW_ADMIN_BOOTSTRAP: "",
    BOOTSTRAP_ADMIN_EMAIL: "",
    BOOTSTRAP_ADMIN_FIRST_NAME: "",
    BOOTSTRAP_ADMIN_LAST_NAME: "",
    BOOTSTRAP_ADMIN_PASSWORD: "",
  })
);

const webKeys = new Set([
  "NODE_ENV",
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_WHATSAPP_TEXT_ONLY_MVP",
  "NEXT_PUBLIC_ALLOW_AUTH_TEMPLATES",
  "NEXT_PUBLIC_ALLOW_UTILITY_TEMPLATES",
]);
const apiKeys = new Map(
  [...rootKeys].filter(([key]) => !webKeys.has(key) || key === "NODE_ENV")
);
const targets = [
  [".env", rootKeys],
  [".env.example", rootKeys],
  ["apps/api/env.example", apiKeys],
];
const sync = process.argv.includes("--sync");

function sourceFiles(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!["node_modules", ".next", "dist", "tmp"].includes(entry.name))
        sourceFiles(file, output);
    } else if (
      /\.(?:cjs|js|jsx|mjs|prisma|ts|tsx)$/.test(entry.name) &&
      file !== "scripts/check-environment-keys.mjs"
    )
      output.push(file);
  }
  return output;
}

function declaredKeyList(text) {
  return text.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    return match ? [match[1]] : [];
  });
}

function declaredKeys(text) {
  return new Set(declaredKeyList(text));
}

let failed = false;
const sourceText = ["apps", "packages", "scripts"]
  .flatMap(directory => sourceFiles(directory))
  .map(file => fs.readFileSync(file, "utf8"))
  .join("\n");
const referenced = new Set(
  [
    ...sourceText.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g),
    ...sourceText.matchAll(/env\(["']([A-Z][A-Z0-9_]*)["']\)/g),
  ].map(match => match[1])
);
const undocumentedReferences = [...referenced].filter(
  key => !rootKeys.has(key)
);
const unusedKeys = [...rootKeys.keys()].filter(
  key => !new RegExp(`\\b${key}\\b`).test(sourceText)
);
if (undocumentedReferences.length || unusedKeys.length) {
  failed = true;
  if (undocumentedReferences.length)
    process.stderr.write(
      `Undocumented source keys: ${undocumentedReferences.join(", ")}\n`
    );
  if (unusedKeys.length)
    process.stderr.write(
      `Environment keys without a source consumer: ${unusedKeys.join(", ")}\n`
    );
}
for (const [file, expected] of targets) {
  let text = fs.readFileSync(file, "utf8");
  let present = declaredKeys(text);
  let irrelevant = [...present].filter(key => !expected.has(key));
  if (sync && irrelevant.length) {
    const irrelevantSet = new Set(irrelevant);
    text = text
      .split(/\r?\n/)
      .filter(line => {
        const match = line.match(
          /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/
        );
        return !match || !irrelevantSet.has(match[1]);
      })
      .join("\n");
    fs.writeFileSync(file, text, "utf8");
    present = declaredKeys(text);
    irrelevant = [];
  }
  const missing = [...expected].filter(([key]) => !present.has(key));
  if (sync && missing.length) {
    const separator = text.endsWith("\n") ? "" : "\n";
    const additions = missing
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join("\n");
    fs.writeFileSync(
      file,
      `${text}${separator}\n# Environment keys added by repository consistency audit\n${additions}\n`,
      "utf8"
    );
    text = fs.readFileSync(file, "utf8");
    present = declaredKeys(text);
  }
  const remainingMissing = [...expected.keys()].filter(
    key => !present.has(key)
  );
  const expectedOrder = [...expected.keys()];
  const actualOrder = declaredKeyList(text);
  const orderMismatch =
    actualOrder.length === expectedOrder.length &&
    actualOrder.some((key, index) => key !== expectedOrder[index]);
  if (remainingMissing.length || irrelevant.length || orderMismatch) {
    failed = true;
    if (remainingMissing.length)
      process.stderr.write(`${file}: missing ${remainingMissing.join(", ")}\n`);
    if (irrelevant.length)
      process.stderr.write(`${file}: irrelevant ${irrelevant.join(", ")}\n`);
    if (orderMismatch)
      process.stderr.write(`${file}: keys are outside canonical sections\n`);
  } else process.stdout.write(`${file}: ${present.size} relevant keys\n`);
}

if (failed) process.exit(1);
