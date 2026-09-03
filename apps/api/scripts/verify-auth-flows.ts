import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient({ log: [] });
const API = "http://localhost:4000";
const email = `authcheck.${Date.now()}@workflow-test.example`;
const password = "Test-Password-123!";

let pass = 0,
  fail = 0;
const ok = (c: boolean, label: string, extra = "") => {
  console.log(c ? `✓ ${label}` : `✗ ${label} ${extra}`);
  if (c) pass++;
  else fail++;
};
const post = async (p: string, body: unknown) => {
  const r = await fetch(`${API}${p}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

const user = await prisma.user.create({
  data: {
    firstName: "Auth",
    lastName: "Check",
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role: "ADMIN",
  },
});
try {
  ok(!user.emailOtpVerifiedAt, "new account starts with no second factor");

  const soloLogin = await post("/api/auth/login", { email, password });
  ok(
    soloLogin.status === 200 && !!soloLogin.json.token,
    "password-only account signs straight in",
    `got ${soloLogin.status}`
  );
  ok(
    soloLogin.json.mfaRequired === undefined,
    "no code is demanded when no second factor is enrolled"
  );

  await prisma.user.update({
    where: { id: user.id },
    data: { emailOtpVerifiedAt: new Date() },
  });

  const bad = await post("/api/auth/login", { email, password: "wrong" });
  ok(bad.status === 401, "wrong password -> 401", `got ${bad.status}`);

  const login = await post("/api/auth/login", {
    email: email.toUpperCase(),
    password,
  });
  ok(
    login.status === 200,
    "login (UPPERCASE email) -> 200",
    `got ${login.status} ${JSON.stringify(login.json)}`
  );
  ok(login.json.mfaRequired === true, "mfaRequired true");
  ok(
    login.json.factor === "email",
    `factor is "email"`,
    `got ${login.json.factor}`
  );
  ok(
    Array.isArray(login.json.availableFactors) &&
      login.json.availableFactors.length > 0,
    "availableFactors non-empty"
  );
  ok(
    typeof login.json.maskedEmail === "string" &&
      login.json.maskedEmail.includes("*"),
    "maskedEmail is masked"
  );

  const rows = await prisma.loginOtp.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  ok(
    rows.length === 1,
    "exactly one OTP minted and dispatched",
    `got ${rows.length}`
  );
  ok(!!rows[0] && rows[0].usedAt === null, "OTP is live (Resend accepted it)");

  const mfaToken = login.json.mfaToken;
  const malformed = await post("/api/auth/login/otp/verify", {
    mfaToken,
    otp: "abc",
  });
  ok(
    malformed.status === 400,
    "malformed code -> 400",
    `got ${malformed.status}`
  );

  const wrong = await post("/api/auth/login/otp/verify", {
    mfaToken,
    otp: "000000",
  });
  ok(wrong.status === 401, "wrong code -> 401", `got ${wrong.status}`);
  ok(
    wrong.json.attemptsRemaining === 4,
    "attemptsRemaining counts down",
    `got ${wrong.json.attemptsRemaining}`
  );

  const resent = await post("/api/auth/login/otp/resend", { mfaToken });
  ok(resent.status === 200, "resend -> 200", `got ${resent.status}`);
  const after = await prisma.loginOtp.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  ok(after.length === 2, "resend minted a second code", `got ${after.length}`);
  ok(after[1]?.usedAt !== null, "previous code was burned on resend");

  const noSession = await post("/api/auth/login/otp/verify", {
    mfaToken: "garbage",
    otp: "123456",
  });
  ok(
    noSession.status === 401,
    "forged mfaToken -> 401",
    `got ${noSession.status}`
  );

  const forgot = await post("/api/auth/forgot-password", {
    email: email.toUpperCase(),
  });
  ok(
    forgot.status === 200 && forgot.json.success === true,
    "forgot-password (UPPERCASE) -> success"
  );
  const resets = await prisma.passwordReset.findMany({
    where: { userId: user.id },
  });
  ok(
    resets.length === 1 && resets[0]?.usedAt === null,
    "reset code minted and live (normalisation fix)",
    `got ${resets.length}`
  );

  const unknown = await post("/api/auth/forgot-password", {
    email: "nobody@nowhere.example",
  });
  ok(
    unknown.status === 200 && unknown.json.success === true,
    "unknown email -> generic success (no enumeration)"
  );
} finally {
  await prisma.loginOtp.deleteMany({ where: { userId: user.id } });
  await prisma.passwordReset.deleteMany({ where: { userId: user.id } });
  await prisma.auditLog.deleteMany({ where: { changedBy: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed  (test user removed)`);
  process.exit(fail ? 1 : 0);
}
