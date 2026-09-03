import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
const TEST_SECRET = "test-only-secret-with-at-least-32-characters";
process.env.JWT_SECRET = TEST_SECRET;

const {
  generateAakramanToken,
  generateMfaToken,
  generateResetToken,
  generateSubdealerToken,
  generateToken,
  verifyAakramanToken,
  verifyMfaToken,
  verifyResetToken,
  verifySubdealerToken,
  verifyToken,
} = await import("../src/utils/jwt.utils.js");

const tokens = {
  session: generateToken(11, "staff@example.com", { sessionVersion: 3 }),
  reset: generateResetToken(11, "reset-record-1", 3),
  subdealer: generateSubdealerToken(22, "9876543210", "22AAAAA0000A1Z5"),
  mfa: generateMfaToken(11, 3),
  aakraman: generateAakramanToken(11, "9876543210", "sales@example.com", 3),
};

const verifiers = {
  session: verifyToken,
  reset: verifyResetToken,
  subdealer: verifySubdealerToken,
  mfa: verifyMfaToken,
  aakraman: verifyAakramanToken,
};

test("each JWT verifier accepts only its own token family", () => {
  for (const [verifierName, verify] of Object.entries(verifiers)) {
    for (const [tokenName, token] of Object.entries(tokens)) {
      if (verifierName === tokenName) {
        assert.doesNotThrow(() => verify(token));
      } else {
        assert.throws(() => verify(token), /Invalid token/);
      }
    }
  }
});

test("staff sessions retain required identity and scope claims", () => {
  const payload = verifyToken(tokens.session);
  assert.equal(payload.kind, "session");
  assert.equal(payload.userId, 11);
  assert.equal(payload.email, "staff@example.com");
  assert.equal(payload.sessionVersion, 3);
  assert.equal(payload.iss, "ralli-wolf-api");
  assert.equal(payload.aud, "ralli-wolf:staff-session");
});

test("staff verification rejects legacy, mis-scoped and wrong-algorithm JWTs", () => {
  const identity = {
    kind: "session",
    userId: 11,
    email: "staff@example.com",
    sessionVersion: 3,
  };

  const malformedTokens = [
    jwt.sign({ userId: 11, email: identity.email }, TEST_SECRET),
    jwt.sign({ ...identity, kind: "mfa" }, TEST_SECRET, {
      algorithm: "HS256",
      issuer: "ralli-wolf-api",
      audience: "ralli-wolf:staff-session",
    }),
    jwt.sign(identity, TEST_SECRET, {
      algorithm: "HS256",
      issuer: "another-service",
      audience: "ralli-wolf:staff-session",
    }),
    jwt.sign(identity, TEST_SECRET, {
      algorithm: "HS256",
      issuer: "ralli-wolf-api",
      audience: "ralli-wolf:mfa-challenge",
    }),
    jwt.sign(identity, TEST_SECRET, {
      algorithm: "HS384",
      issuer: "ralli-wolf-api",
      audience: "ralli-wolf:staff-session",
    }),
  ];

  for (const token of malformedTokens) {
    assert.throws(() => verifyToken(token), /Invalid token/);
  }
});
