import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateToken } from "../src/utils/jwt.utils.js";
const prisma = new PrismaClient({ log: [] });
const API = "http://localhost:4000";
const email = `methods.${Date.now()}@workflow-test.example`;
const password = "Test-Password-123!";

let pass = 0,
  fail = 0;
const ok = (c: boolean, label: string, extra = "") => {
  console.log(c ? `✓ ${label}` : `✗ ${label} ${extra}`);
  if (c) pass++;
  else fail++;
};
const call = async (
  method: string,
  p: string,
  body?: unknown,
  token?: string
) => {
  const r = await fetch(`${API}${p}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

const user = await prisma.user.create({
  data: {
    firstName: "Methods",
    lastName: "Check",
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role: "ADMIN",
  },
});
const token = generateToken(user.id, user.email, {
  sessionVersion: user.sessionVersion,
});
try {
  const fresh = await call("GET", "/api/auth/methods", undefined, token);
  ok(
    fresh.json.minimumRequired === 1,
    "minimum is now 1",
    `got ${fresh.json.minimumRequired}`
  );
  ok(
    fresh.json.activeCount === 1,
    "a new account starts with password only",
    `got ${fresh.json.activeCount}`
  );

  await prisma.user.update({
    where: { id: user.id },
    data: { emailOtpVerifiedAt: new Date() },
  });
  const sum = await call("GET", "/api/auth/methods", undefined, token);
  ok(
    sum.json.activeCount === 2,
    "enrolling the email code gives two methods",
    `got ${sum.json.activeCount}`
  );

  const off = await call(
    "DELETE",
    "/api/auth/methods/password",
    undefined,
    token
  );
  ok(
    off.status === 200,
    "password can be turned off",
    `got ${off.status} ${JSON.stringify(off.json)}`
  );
  ok(
    off.json.activeCount === 1,
    "one method left",
    `got ${off.json.activeCount}`
  );

  const pwless = await call("POST", "/api/auth/login", { email });
  ok(
    pwless.status === 200,
    "passwordless login accepted",
    `got ${pwless.status}`
  );
  ok(
    pwless.json.factor === "email",
    "entry is the email code",
    `got ${pwless.json.factor}`
  );
  const otps = await prisma.loginOtp.count({
    where: { userId: user.id, usedAt: null },
  });
  ok(otps === 1, "a code was actually sent", `got ${otps}`);

  const stale = await call("POST", "/api/auth/login", { email, password });
  ok(
    stale.status === 200 && stale.json.mfaRequired === true,
    "old password neither accepted nor rejected — still challenged",
    `got ${stale.status}`
  );

  const last = await call(
    "DELETE",
    "/api/auth/methods/email",
    undefined,
    token
  );
  ok(
    last.status === 409,
    "cannot remove the last method",
    `got ${last.status}`
  );

  const back = await call(
    "POST",
    "/api/auth/methods/password",
    { newPassword: "Another-Password-9!" },
    token
  );
  ok(
    back.status === 200,
    "password can be set again",
    `got ${back.status} ${JSON.stringify(back.json)}`
  );
  ok(
    back.json.activeCount === 2,
    "back to two methods",
    `got ${back.json.activeCount}`
  );
  const short = await call(
    "POST",
    "/api/auth/methods/password",
    { newPassword: "short" },
    token
  );
  ok(short.status === 400, "short password rejected", `got ${short.status}`);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailOtpVerifiedAt: null },
  });
  const solo = await call("GET", "/api/auth/methods", undefined, token);
  ok(
    solo.json.activeCount === 1,
    "password-only is a valid state",
    `got ${solo.json.activeCount}`
  );
  const direct = await call("POST", "/api/auth/login", {
    email,
    password: "Another-Password-9!",
  });
  ok(
    direct.status === 200 && !!direct.json.token,
    "password-only logs straight in",
    `got ${direct.status}`
  );
  ok(direct.json.mfaRequired === undefined, "no second factor demanded");
  const wrong = await call("POST", "/api/auth/login", {
    email,
    password: "nope",
  });
  ok(
    wrong.status === 401,
    "wrong password still rejected",
    `got ${wrong.status}`
  );
} finally {
  await prisma.loginOtp.deleteMany({ where: { userId: user.id } });
  await prisma.auditLog.deleteMany({ where: { changedBy: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed  (test user removed)`);
  process.exit(fail ? 1 : 0);
}
