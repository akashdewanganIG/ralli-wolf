import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { createApp } from "../src/app.js";

async function withServer(
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = createApp();
  app.get("/probe", (_req, res) => res.json({ ok: true }));
  app.get("/api/probe", (_req, res) => res.json({ ok: true }));
  app.post("/raw", (req, res) => {
    const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
    res.json({ raw: rawBody?.toString("utf8") ?? null });
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
    });
  }
}

test("API security headers and exact CORS allowlist are enforced", async () => {
  const originalOrigins = process.env.CORS_ALLOWED_ORIGINS;
  const originalFrontend = process.env.FRONTEND_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalTrustProxy = process.env.TRUST_PROXY_HOPS;
  process.env.CORS_ALLOWED_ORIGINS = "https://portal.example.com";
  delete process.env.FRONTEND_URL;
  process.env.NODE_ENV = "production";
  process.env.TRUST_PROXY_HOPS = "0";
  try {
    await withServer(async baseUrl => {
      const allowed = await fetch(`${baseUrl}/probe`, {
        headers: { Origin: "https://portal.example.com" },
      });
      assert.equal(allowed.status, 200);
      assert.equal(
        allowed.headers.get("access-control-allow-origin"),
        "https://portal.example.com"
      );
      assert.equal(
        allowed.headers.get("access-control-allow-credentials"),
        "true"
      );
      assert.equal(allowed.headers.get("x-content-type-options"), "nosniff");
      assert.equal(allowed.headers.get("x-frame-options"), "DENY");
      assert.equal(allowed.headers.get("referrer-policy"), "no-referrer");
      assert.match(
        allowed.headers.get("strict-transport-security") || "",
        /max-age=31536000/
      );
      assert.equal(allowed.headers.get("x-powered-by"), null);

      const apiResponse = await fetch(`${baseUrl}/api/probe`, {
        headers: { Origin: "https://portal.example.com" },
      });
      assert.equal(apiResponse.headers.get("cache-control"), "no-store");

      const denied = await fetch(`${baseUrl}/probe`, {
        headers: { Origin: "https://attacker.example" },
      });
      assert.equal(denied.status, 403);
      assert.equal(denied.headers.get("access-control-allow-origin"), null);
      assert.equal(denied.headers.get("x-frame-options"), "DENY");
    });
  } finally {
    if (originalOrigins === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
    else process.env.CORS_ALLOWED_ORIGINS = originalOrigins;
    if (originalFrontend === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontend;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = originalTrustProxy;
  }
});

test("raw JSON bytes are retained exactly for webhook authentication", async () => {
  const originalOrigins = process.env.CORS_ALLOWED_ORIGINS;
  const originalTrustProxy = process.env.TRUST_PROXY_HOPS;
  process.env.CORS_ALLOWED_ORIGINS = "https://portal.example.com";
  process.env.TRUST_PROXY_HOPS = "0";
  const body = '{  "second": 2, "first": 1 }';
  try {
    await withServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/raw`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      assert.deepEqual(await response.json(), { raw: body });
    });
  } finally {
    if (originalOrigins === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
    else process.env.CORS_ALLOWED_ORIGINS = originalOrigins;
    if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = originalTrustProxy;
  }
});

test("invalid CORS and proxy configuration fail during app creation", () => {
  const originalOrigins = process.env.CORS_ALLOWED_ORIGINS;
  const originalTrustProxy = process.env.TRUST_PROXY_HOPS;
  try {
    process.env.CORS_ALLOWED_ORIGINS = "https://portal.example.com/path";
    process.env.TRUST_PROXY_HOPS = "0";
    assert.throws(() => createApp(), /Invalid CORS origin/);

    process.env.CORS_ALLOWED_ORIGINS = "https://portal.example.com";
    process.env.TRUST_PROXY_HOPS = "11";
    assert.throws(() => createApp(), /TRUST_PROXY_HOPS/);
  } finally {
    if (originalOrigins === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
    else process.env.CORS_ALLOWED_ORIGINS = originalOrigins;
    if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = originalTrustProxy;
  }
});
