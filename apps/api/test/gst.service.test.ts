import assert from "node:assert/strict";
import test from "node:test";
import {
  GstRecordNotFoundError,
  GstService,
  GstServiceUnavailableError,
} from "../src/services/gst.service.js";

const VALID_GSTIN = "27ABCDE1234F1Z5";

function withProviderResponse(
  body: unknown,
  run: (service: GstService) => Promise<void>,
  status = 200
) {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GST_API_KEY;
  process.env.GST_API_KEY = "test-provider-key";
  globalThis.fetch = async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  return run(new GstService()).finally(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GST_API_KEY;
    else process.env.GST_API_KEY = originalKey;
  });
}

test("GST verification fails closed when no provider is configured", async () => {
  const originalKey = process.env.GST_API_KEY;
  delete process.env.GST_API_KEY;
  try {
    await assert.rejects(
      () => new GstService().fetchGstDetails(VALID_GSTIN),
      GstServiceUnavailableError
    );
  } finally {
    if (originalKey !== undefined) process.env.GST_API_KEY = originalKey;
  }
});

test("GST verification rejects a mismatched provider registration", async () => {
  await withProviderResponse(
    { flag: true, data: { gstin: "29ABCDE1234F1Z5", lgnm: "Wrong Entity" } },
    async service => {
      await assert.rejects(
        () => service.fetchGstDetails(VALID_GSTIN),
        GstServiceUnavailableError
      );
    }
  );
});

test("GST verification rejects incomplete legal data instead of fabricating it", async () => {
  await withProviderResponse(
    { flag: true, data: { gstin: VALID_GSTIN } },
    async service => {
      await assert.rejects(
        () => service.fetchGstDetails(VALID_GSTIN),
        GstServiceUnavailableError
      );
    }
  );
});

test("GST verification preserves absent optional legal fields", async () => {
  await withProviderResponse(
    { flag: true, data: { gstin: VALID_GSTIN, lgnm: "Verified Entity" } },
    async service => {
      const result = await service.fetchGstDetails(VALID_GSTIN);
      assert.equal(result.legalName, "Verified Entity");
      assert.equal(result.state, undefined);
      assert.equal(result.status, undefined);
      assert.equal(result.registrationDate, undefined);
    }
  );
});

test("GST provider not-found responses have a distinct business outcome", async () => {
  await withProviderResponse(
    { flag: false, message: "not found" },
    async service => {
      await assert.rejects(
        () => service.fetchGstDetails(VALID_GSTIN),
        GstRecordNotFoundError
      );
    }
  );
});

test("GST verification rejects structurally invalid provider data", async () => {
  await withProviderResponse(
    { flag: true, data: "not-an-object" },
    async service => {
      await assert.rejects(
        () => service.fetchGstDetails(VALID_GSTIN),
        GstServiceUnavailableError
      );
    }
  );
});

test("GST verification rejects provider responses declared over the size limit", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GST_API_KEY;
  process.env.GST_API_KEY = "test-provider-key";
  globalThis.fetch = async () =>
    new Response("{}", {
      headers: {
        "content-length": "1000001",
        "content-type": "application/json",
      },
    });
  try {
    await assert.rejects(
      () => new GstService().fetchGstDetails(VALID_GSTIN),
      GstServiceUnavailableError
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GST_API_KEY;
    else process.env.GST_API_KEY = originalKey;
  }
});
