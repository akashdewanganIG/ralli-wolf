import assert from "node:assert/strict";
import test from "node:test";
import {
  requiredSignInChallenge,
  secondFactorFor,
  signInEntry,
  type AuthMethodUser,
} from "../src/services/auth-methods.service.js";

function user(overrides: Partial<AuthMethodUser> = {}): AuthMethodUser {
  return {
    id: 1,
    email: "user@example.com",
    passwordEnabled: true,
    totpSecret: null,
    totpVerifiedAt: null,
    emailOtpVerifiedAt: null,
    ...overrides,
  };
}

test("password-only accounts do not receive an authentication challenge", () => {
  const account = user();
  const entry = signInEntry(account);
  assert.equal(entry, "password");
  assert.equal(requiredSignInChallenge(account, entry), null);
  assert.deepEqual(secondFactorFor(account), {
    preferred: null,
    available: [],
  });
});

test("password accounts require only second factors that are verified", () => {
  const emailAccount = user({ emailOtpVerifiedAt: new Date() });
  const emailEntry = signInEntry(emailAccount);
  assert.equal(emailEntry, "password");
  assert.equal(requiredSignInChallenge(emailAccount, emailEntry), "email");

  const totpAccount = user({
    totpSecret: "sealed-secret",
    totpVerifiedAt: new Date(),
    emailOtpVerifiedAt: new Date(),
  });
  const totpEntry = signInEntry(totpAccount);
  assert.equal(totpEntry, "password");
  assert.equal(requiredSignInChallenge(totpAccount, totpEntry), "totp");
  assert.deepEqual(secondFactorFor(totpAccount).available, ["totp", "email"]);
});

test("passwordless accounts challenge with their enabled method", () => {
  const emailAccount = user({
    passwordEnabled: false,
    emailOtpVerifiedAt: new Date(),
  });
  const emailEntry = signInEntry(emailAccount);
  assert.equal(emailEntry, "email");
  assert.equal(requiredSignInChallenge(emailAccount, emailEntry), "email");

  const totpAccount = user({
    passwordEnabled: false,
    totpSecret: "sealed-secret",
    totpVerifiedAt: new Date(),
  });
  const totpEntry = signInEntry(totpAccount);
  assert.equal(totpEntry, "totp");
  assert.equal(requiredSignInChallenge(totpAccount, totpEntry), "totp");
});
