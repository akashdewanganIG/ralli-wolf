import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import {
  bearerSessionResponse,
  clearStaffSessionCookie,
  setStaffSessionCookie,
  staffSessionCookieName,
  staffSessionToken,
} from "../src/utils/session-cookie.js";

function request(headers: Record<string, string> = {}): Request {
  return {
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  } as Request;
}

function response() {
  const cookies: Array<{
    action: "set" | "clear";
    name: string;
    value?: string;
    options: Record<string, unknown>;
  }> = [];
  const headers = new Map<string, unknown>();
  const res = {
    cookie(name: string, value: string, options: Record<string, unknown>) {
      cookies.push({ action: "set", name, value, options });
      return this;
    },
    clearCookie(name: string, options: Record<string, unknown>) {
      cookies.push({ action: "clear", name, options });
      return this;
    },
    setHeader(name: string, value: unknown) {
      headers.set(name.toLowerCase(), value);
      return this;
    },
  } as unknown as Response;
  return { res, cookies, headers };
}

test("staff session prefers an explicit bearer and otherwise reads its cookie", () => {
  const name = staffSessionCookieName();
  assert.equal(
    staffSessionToken(
      request({
        authorization: "Bearer cli-token",
        cookie: `${name}=browser-token; preference=compact`,
      })
    ),
    "cli-token"
  );
  assert.equal(
    staffSessionToken(
      request({ cookie: `preference=compact; ${name}=browser-token` })
    ),
    "browser-token"
  );
  assert.equal(staffSessionToken(request()), null);
});

test("production staff cookies are host-only, HttpOnly, secure and strict", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const { res, cookies, headers } = response();
    setStaffSessionCookie(res, "signed-token");
    clearStaffSessionCookie(res);

    assert.equal(cookies.length, 2);
    assert.equal(cookies[0]?.name, "__Host-ralli_wolf_session");
    assert.equal(cookies[0]?.value, "signed-token");
    assert.deepEqual(cookies[0]?.options, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
    });
    assert.equal(cookies[1]?.action, "clear");
    assert.equal(headers.get("cache-control"), "no-store");
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("bearer credentials are returned only when a client explicitly opts in", () => {
  assert.deepEqual(bearerSessionResponse(request(), "secret"), {});
  assert.deepEqual(
    bearerSessionResponse(request({ "x-session-mode": "bearer" }), "secret"),
    { token: "secret" }
  );
  assert.deepEqual(
    bearerSessionResponse(
      request({ "x-session-mode": "BEARER" }),
      "secret",
      "sessionToken"
    ),
    { sessionToken: "secret" }
  );
});
