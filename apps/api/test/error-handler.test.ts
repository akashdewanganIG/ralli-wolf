import assert from "node:assert/strict";
import test from "node:test";
import type { Response } from "express";
import { Prisma } from "@prisma/client";

import {
  handlePrismaError,
  validateRequiredFields,
} from "../src/utils/error-handler.js";

function responseRecorder(): {
  response: Response;
  status: () => number;
  body: () => unknown;
} {
  let statusCode = 200;
  let responseBody: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  } as unknown as Response;
  return {
    response,
    status: () => statusCode,
    body: () => responseBody,
  };
}

test("database conflicts do not expose schema constraint metadata", () => {
  const recorded = responseRecorder();
  const error = new Prisma.PrismaClientKnownRequestError("duplicate", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: ["password_hash", "email"] },
  });

  handlePrismaError(error, recorded.response, "Create user");

  assert.equal(recorded.status(), 409);
  const serialized = JSON.stringify(recorded.body());
  assert.doesNotMatch(serialized, /password_hash|"field"|"details"/i);
});

test("required-field checks reject inherited or blank values but accept false and zero", () => {
  const inherited = Object.create({ name: "inherited" }) as Record<
    string,
    unknown
  >;
  const missing = responseRecorder();
  assert.equal(
    validateRequiredFields(inherited, ["name"], missing.response),
    false
  );
  assert.equal(missing.status(), 400);

  const present = responseRecorder();
  assert.equal(
    validateRequiredFields(
      { enabled: false, count: 0 },
      ["enabled", "count"],
      present.response
    ),
    true
  );
});
