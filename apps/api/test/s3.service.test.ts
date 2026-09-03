import assert from "node:assert/strict";
import test from "node:test";

import {
  extractS3KeyFromReference,
  extractS3KeyFromUrl,
  generateS3Key,
  getSignedS3DownloadUrl,
} from "../src/services/s3.service.js";

test("S3 keys are sanitized and collision resistant", () => {
  const first = generateS3Key("whatsapp-campaign", "../Quarterly plan", "pdf");
  const second = generateS3Key("whatsapp-campaign", "../Quarterly plan", "pdf");
  assert.match(first, /^whatsapp-campaign\/Quarterly-plan-[0-9a-f-]{36}\.pdf$/);
  assert.notEqual(first, second);
  assert.match(
    generateS3Key("../unsafe/folder", "name", "P.DF"),
    /^unsafe\/folder\/name-[0-9a-f-]{36}\.pdf$/
  );
});

test("S3 references only accept internal keys or this deployment's bucket", () => {
  const originalBucket = process.env.S3_BUCKET_NAME;
  const originalRegion = process.env.AWS_REGION;
  const originalEndpoint = process.env.S3_ENDPOINT;
  const originalPublicBase = process.env.S3_PUBLIC_BASE_URL;
  process.env.S3_BUCKET_NAME = "company-private-files";
  process.env.AWS_REGION = "ap-south-1";
  delete process.env.S3_ENDPOINT;
  delete process.env.S3_PUBLIC_BASE_URL;
  try {
    assert.equal(
      extractS3KeyFromReference("s3://invoices/invoice-1.pdf"),
      "invoices/invoice-1.pdf"
    );
    assert.equal(
      extractS3KeyFromUrl(
        "https://company-private-files.s3.ap-south-1.amazonaws.com/invoices/invoice-1.pdf"
      ),
      "invoices/invoice-1.pdf"
    );
    assert.equal(
      extractS3KeyFromUrl("https://attacker.example/invoices/invoice-1.pdf"),
      null
    );
    assert.equal(extractS3KeyFromReference("s3://../secret"), null);
  } finally {
    if (originalBucket === undefined) delete process.env.S3_BUCKET_NAME;
    else process.env.S3_BUCKET_NAME = originalBucket;
    if (originalRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = originalRegion;
    if (originalEndpoint === undefined) delete process.env.S3_ENDPOINT;
    else process.env.S3_ENDPOINT = originalEndpoint;
    if (originalPublicBase === undefined) delete process.env.S3_PUBLIC_BASE_URL;
    else process.env.S3_PUBLIC_BASE_URL = originalPublicBase;
  }
});

test("signed S3 downloads reject traversal and unsafe expiry values", async () => {
  await assert.rejects(
    getSignedS3DownloadUrl("../private/document.pdf"),
    /Invalid S3 object key/
  );
  await assert.rejects(
    getSignedS3DownloadUrl("whatsapp-campaign/document.pdf", 10),
    /expiry/
  );
});

test("public base URL overrides drive public URLs and key extraction", () => {
  const original = {
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    AWS_REGION: process.env.AWS_REGION,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_PUBLIC_BASE_URL: process.env.S3_PUBLIC_BASE_URL,
  };
  process.env.S3_BUCKET_NAME = "ralli-media";
  process.env.AWS_REGION = "ap-south-1";
  process.env.S3_ENDPOINT = "https://project.supabase.co/storage/v1/s3";
  process.env.S3_PUBLIC_BASE_URL =
    "https://project.supabase.co/storage/v1/object/public/{bucket}";
  try {
    assert.equal(
      extractS3KeyFromUrl(
        "https://project.supabase.co/storage/v1/object/public/ralli-media/warehouses/wh-1.jpg"
      ),
      "warehouses/wh-1.jpg"
    );

    assert.equal(
      extractS3KeyFromUrl(
        "https://project.supabase.co/storage/v1/s3/ralli-media/warehouses/wh-1.jpg"
      ),
      null
    );
    assert.equal(
      extractS3KeyFromUrl("https://attacker.example/warehouses/wh-1.jpg"),
      null
    );
  } finally {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
