# File storage configuration

Last updated: 2026-09-03

## Overview

All uploaded files in this project — product images, warehouse photos, invoice
PDFs, and WhatsApp campaign media — go through a single S3-compatible storage
layer in [`apps/api/src/services/s3.service.ts`](../apps/api/src/services/s3.service.ts).
Nothing is written to the local filesystem, and no binary data is stored in
Postgres. The database only ever holds a reference to the object.

The architecture is deliberately **provider-neutral**. The API speaks the S3
protocol, so AWS S3, Supabase Storage, Cloudflare R2, DigitalOcean Spaces, and
MinIO are all reachable without code changes — you switch providers by changing
environment variables only.

This document describes that layer and records the current production-testing
setup (Supabase Storage).

## How an upload flows

1. **Multer buffers the file in memory.** No temp files on disk. Each route sets
   its own size and count limits — for example warehouse images are capped at
   5 MB and 8 files in
   [`supply-chain.routes.ts`](../apps/api/src/routes/supply-chain.routes.ts).
2. **The content is verified.** `verifyFileContent` in
   [`file-validation.ts`](../apps/api/src/utils/file-validation.ts) inspects
   magic bytes rather than trusting the client-declared MIME type.
3. **The object is uploaded.** `uploadToS3` generates a sanitised, collision-
   resistant key of the form `<folder>/<name>-<uuid>.<ext>`.
4. **Only a reference is persisted.** Public files store a full URL; private
   files store an `s3://<key>` reference.

## What is stored where

| Folder               | Written by                                                                       | Access      | Reference stored in DB |
| -------------------- | -------------------------------------------------------------------------------- | ----------- | ---------------------- |
| `warehouses/`        | [`warehouse.controller.ts`](../apps/api/src/controllers/warehouse.controller.ts) | **Public**  | Full public URL        |
| `products/`          | [`product.controller.ts`](../apps/api/src/controllers/product.controller.ts)     | **Public**  | Full public URL        |
| `invoices/`          | [`invoice.controller.ts`](../apps/api/src/controllers/invoice.controller.ts)     | **Private** | `s3://<key>`           |
| `whatsapp-campaign/` | [`whatsapp.controller.ts`](../apps/api/src/controllers/whatsapp.controller.ts)   | **Private** | `s3://<key>`           |

Public objects are uploaded with `publicRead: true` and rendered directly by the
browser. Private objects are never publicly readable; they are served through
short-lived presigned URLs produced by `getSignedS3DownloadUrl` — 5 minutes for
invoice downloads, 1 hour for WhatsApp media handed to MSG91.

This split is the main constraint when choosing a provider: **the provider must
support both public objects and presigned URLs.** Image-only CDNs are not a
drop-in replacement.

## Environment variables

| Variable                | Required | Purpose                                                                    |
| ----------------------- | -------- | -------------------------------------------------------------------------- |
| `AWS_ACCESS_KEY_ID`     | Yes      | Access key. For non-AWS providers, the key that provider issues.            |
| `AWS_SECRET_ACCESS_KEY` | Yes      | Secret key.                                                                 |
| `AWS_REGION`            | Yes      | Region. Must match the bucket's region, even on non-AWS providers.          |
| `S3_BUCKET_NAME`        | Yes      | Bucket name.                                                                |
| `S3_ENDPOINT`           | No       | S3 API endpoint. Empty for AWS. Required for every other provider.          |
| `S3_FORCE_PATH_STYLE`   | No       | `true` for providers that require path-style addressing (Supabase, MinIO).  |
| `S3_USE_ACL`            | No       | `true` only if the provider grants public read via per-object ACLs.         |
| `S3_PUBLIC_BASE_URL`    | No       | Base URL for public objects when it differs from `S3_ENDPOINT`. See below.  |

### Why `S3_PUBLIC_BASE_URL` exists

On AWS, the host you upload to and the host that serves the file are the same,
so the public URL can be derived from the bucket and region.

Several providers separate the two. Supabase writes through
`…supabase.co/storage/v1/s3` but serves through
`…supabase.co/storage/v1/object/public/<bucket>`; Cloudflare R2 writes to
`…r2.cloudflarestorage.com` and serves from `pub-….r2.dev` or a custom domain.

Without an explicit public base, uploads would succeed while every URL written
to the database pointed at the private API host — broken images, and broken
deletes, since `extractS3KeyFromUrl` validates candidate URLs against the same
derived origin before allowing an object to be removed.

The value supports a `{bucket}` token, which is substituted with
`S3_BUCKET_NAME`. Leave it empty on AWS.

## Current setup: Supabase Storage

Supabase is used for production testing because it offers an S3-compatible
endpoint on a free tier that does not require a payment method. The application
code is unaware of this choice.

### 1. Create the bucket

In the Supabase dashboard → **Storage** → **New bucket**:

- Name: `ralli-wolf-media` (or your preference)
- **Public bucket: ON** — required so product and warehouse images render
  directly in the browser

Public here refers to read access. Writes still require the credentials below.

### 2. Create S3 access keys

**Project Settings** → **Storage** → **S3 Access Keys** → **New access key**.
Supabase shows the secret once; copy both values immediately.

The same settings page shows the **S3 endpoint** and the **region** assigned to
your project. Use those exact values — the region is validated on every request.

### 3. Configure environment variables

Set these in `.env` locally and in the Render service's environment:

```bash
AWS_ACCESS_KEY_ID="<supabase s3 access key id>"
AWS_SECRET_ACCESS_KEY="<supabase s3 secret access key>"
AWS_REGION="<project region, e.g. ap-south-1>"
S3_BUCKET_NAME="ralli-wolf-media"
S3_ENDPOINT="https://<project-ref>.supabase.co/storage/v1/s3"
S3_FORCE_PATH_STYLE="true"
S3_USE_ACL="false"
S3_PUBLIC_BASE_URL="https://<project-ref>.supabase.co/storage/v1/object/public/{bucket}"
```

Notes:

- `S3_FORCE_PATH_STYLE` **must** be `true`; Supabase does not support
  virtual-host-style bucket addressing.
- `S3_USE_ACL` **must** be `false`. Supabase has no per-object ACLs — public
  read comes from the bucket being marked public.
- Restart the API after changing these; they are read from the environment when
  the S3 client is first constructed.

### 4. Private files

Invoice PDFs and WhatsApp media stay private even in a public bucket, because
they are stored as `s3://` references and only ever handed out as presigned
URLs. Supabase supports presigned URLs through its S3 protocol layer, so this
works unchanged.

If you would rather keep a hard separation, create a second **private** bucket
and point a separate deployment at it. The current code uses one bucket for all
folders.

## Switching providers later

Only environment variables change — no code, and no change to the reference
format. Existing rows keep whatever absolute URLs they were written with, so
previously uploaded public files must be copied to the new bucket or re-uploaded
if you want them to keep resolving.

**AWS S3** (the original target — see
[`whatsapp-s3-setup.md`](whatsapp-s3-setup.md) for bucket policy and IAM setup):

```bash
S3_ENDPOINT=""
S3_FORCE_PATH_STYLE="false"
S3_PUBLIC_BASE_URL=""
```

**Cloudflare R2:**

```bash
S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
AWS_REGION="auto"
S3_FORCE_PATH_STYLE="true"
S3_USE_ACL="false"
S3_PUBLIC_BASE_URL="https://pub-<hash>.r2.dev"   # or your custom domain
```

**DigitalOcean Spaces** — special-cased in `getS3PublicUrl`, so the public base
can be left empty:

```bash
S3_ENDPOINT="https://blr1.digitaloceanspaces.com"
S3_USE_ACL="true"
S3_PUBLIC_BASE_URL=""
```

**MinIO, for local development** — the `http` scheme is preserved:

```bash
S3_ENDPOINT="http://localhost:9000"
S3_FORCE_PATH_STYLE="true"
S3_PUBLIC_BASE_URL="http://localhost:9000/{bucket}"
```

## Frontend configuration

[`apps/web/next.config.js`](../apps/web/next.config.js) lists the hosts allowed
in `remotePatterns`: AWS S3, Supabase, R2, and Spaces. Add a host there if you
move to a provider not already listed.

`images.unoptimized` is currently `true`, which bypasses the Next.js image
optimiser — so `remotePatterns` is not enforced today and the configured
`webp`/`avif` formats are not applied. Setting it to `false` would enable
optimisation and make the patterns load-bearing.

## Verifying a configuration

`npm run verify:storage -w api` performs a live round-trip against whichever
provider is configured: it uploads a small PNG, fetches it over its public URL,
round-trips the key extraction that delete paths depend on, presigns a private
download, deletes the object, and confirms via the S3 API that it is gone.

Run it after changing any storage variable, and on the deployed service after
updating its environment.

One detail it accounts for: public URLs are served through a CDN and can keep
answering from cache after an object is deleted, so the delete check queries the
S3 API rather than the public URL. A cached public hit after deletion is normal
and is reported as a note, not a failure.

Two companion scripts cover the image features built on this layer:
`npm run verify:image-routes -w api` registers every route without binding a
port and lists the image endpoints, and `npm run verify:image-schema -w api`
reports whether the image tables exist yet.

## Troubleshooting

**`Missing required S3 env vars`** — region, access key, or secret is unset. They
are read when the S3 client is first constructed, so restart the API after
editing `.env`.

**`S3 access denied` / 403** — credentials are wrong, or still placeholders.
Check that the access key belongs to the same project as `S3_ENDPOINT`.

**`S3 region/endpoint configuration error`** — `AWS_REGION` does not match the
bucket's region, or `S3_FORCE_PATH_STYLE` is unset for a provider that needs it.

**Uploads succeed but images do not render** — `S3_PUBLIC_BASE_URL` is wrong or
missing. Open the stored URL directly in a private browser window; if it 404s or
asks for credentials, the base URL is pointing at the API host rather than the
public one.

**Deleting a warehouse or product image leaves the object behind** — same cause.
`extractS3KeyFromUrl` returns `null` when a stored URL does not match the
configured public base, and the delete is skipped. Fix the base URL; orphaned
objects then need clearing manually.

**Creating a warehouse fails when images are attached** — the upload runs before
the database transaction in `warehouse.controller.ts`, so a storage failure
aborts the whole request and no warehouse is created. Warehouses created without
images are unaffected, which is a quick way to confirm storage is the culprit.
