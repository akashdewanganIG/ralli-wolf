# Local setup and operations

This repository is an npm/Turborepo monorepo with a Next.js web app, an
Express API, and PostgreSQL through Prisma. Configuration is loaded from the
root `.env` file.

## Prerequisites

- Node.js 20.9 or newer
- npm 11
- Docker Desktop (or a reachable PostgreSQL 15+ database)
- OpenSSL or Node.js for generating random secrets

## 1. Install and configure

From the repository root:

```bash
npm install
cp .env.example .env
```

Set the database URLs for the included Docker database:

```dotenv
DATABASE_URL="postgresql://postgres:password@localhost:5433/innovun_crm?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5433/innovun_crm?schema=public"
```

Generate independent secrets. Run the command once for each of
`JWT_SECRET`, `OTP_HASH_SECRET`, and `TOTP_ENCRYPTION_KEY`:

```bash
openssl rand -base64 48
```

`ENCRYPTION_KEY` must decode to exactly 32 bytes:

```bash
openssl rand -base64 32
```

Store that value as `base64:<generated-value>`. Do not reuse one key for
another purpose.

The minimum security and local-origin configuration is:

```dotenv
JWT_SECRET="<at-least-32-random-bytes>"
OTP_HASH_SECRET="<different-at-least-32-random-bytes>"
TOTP_ENCRYPTION_KEY="<different-at-least-32-random-bytes>"
ENCRYPTION_KEY="base64:<32-byte-base64-value>"
JWT_EXPIRES_IN="24h"
CORS_ALLOWED_ORIGINS="http://localhost:3001"
TRUST_PROXY_HOPS=0
NEXT_PUBLIC_API_URL="http://localhost:4000"
FRONTEND_URL="http://localhost:3001"
PORT=4000
NODE_ENV="development"
```

For a working sign-in flow, configure a verified Resend sender:

```dotenv
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="Ralli Wolf <auth@your-domain.example>"
RESEND_REPLY_TO="support@your-domain.example"
```

Features fail closed when their provider is not configured. Configure only the
integrations you intend to exercise; see `.env.example` and
`apps/api/env.example` for the supported provider variables.

## 2. Start PostgreSQL and apply migrations

```bash
docker compose up -d postgres
npm run db:generate
npm run db:deploy
```

Use `npm run db:migrate` while authoring a new migration. Production and CI
deployments should use `npm run db:deploy`.

## 3. Create the initial administrator

There is no HTTP bootstrap route and no environment-based developer login.
Create the first administrator once, out of band:

```dotenv
ALLOW_ADMIN_BOOTSTRAP="CREATE_INITIAL_ADMIN"
BOOTSTRAP_ADMIN_EMAIL="admin@your-domain.example"
BOOTSTRAP_ADMIN_FIRST_NAME="Initial"
BOOTSTRAP_ADMIN_LAST_NAME="Administrator"
BOOTSTRAP_ADMIN_PASSWORD="<14+ chars with upper, lower, number and symbol>"
```

```bash
npm run prisma:bootstrap-admin -w @repo/db
```

The command refuses to run if any active administrator already exists. Remove
the bootstrap confirmation and password from `.env` immediately afterward.
Create subsequent accounts through authenticated user management.

## 4. Optional demo data

The main seed is destructive and is disabled in production. It requires an
explicit acknowledgement and a caller-supplied password:

```dotenv
ALLOW_DESTRUCTIVE_SEED="I_UNDERSTAND_THIS_DELETES_DATA"
DEMO_SEED_PASSWORD="<strong-demo-password-at-least-12-chars>"
```

```bash
npm run db:seed
```

Never run the destructive seed against a database containing real business
data. The non-destructive all-sections demo seed is:

```bash
npm run db:seed:all-demo
npm run db:verify:all-demo
```

Demo accounts always use `DEMO_SEED_PASSWORD`; no password is hardcoded. Seed
reruns rotate those password hashes and invalidate prior sessions.

## 5. Run the application

```bash
npm run dev
```

- Web: `http://localhost:3001`
- API: `http://localhost:4000`
- Health: `http://localhost:4000/health`

The web development command uses Webpack for stable hot reloading. Turbopack
remains available for explicit testing with `npm run dev:turbopack -w web`.
If Turbopack reports an internal `VersionedContents`/HMR panic, stop that
process and return to `npm run dev`; it is a bundler-state failure, not a
database or seed failure.

The browser origin must be listed exactly in `CORS_ALLOWED_ORIGINS`. Set
`TRUST_PROXY_HOPS` to the known number of reverse proxies in front of Express;
do not enable it speculatively.

Production web and API hosts must be HTTPS origins under the same registrable
domain, such as `app.example.com` and `api.example.com`. Staff authentication
uses a `SameSite=Strict` cookie, which intentionally will not be sent between
unrelated hosting domains.

## 6. Verification gates

Run these before opening a pull request or deploying:

```bash
npm run check-types
npm run lint
npm test -w api
npm run build
npx prisma validate --schema packages/db/prisma/schema.prisma
```

For focused checks:

```bash
npm run check-types -w api
npx tsc -p apps/web/tsconfig.json --noEmit
npm run build -w @repo/db
```

## Configuration and operational rules

- Keep `.env` files and provider credentials out of source control.
- Use different secrets in every environment and for every cryptographic
  purpose.
- Configure `RUN_EMBEDDED_SCHEDULERS=true` on only the deployments intended to
  run scheduled jobs. Database leases prevent concurrent execution, but an
  explicit scheduler topology remains easier to operate.
- Configure webhook secrets before enabling Landingi, Brevo, or MSG91 webhook
  delivery. Webhooks fail closed when authentication is absent or invalid.
- Keep the production web and API hosts on the same registrable domain so the
  strict staff session cookie reaches the API.
- Back up the database before migrations and before any approved reset.
- Rotate a provider credential through the integration manager; stored
  credentials are encrypted with `ENCRYPTION_KEY`.
- Use `npm run env:switch:local` or `npm run env:switch:production` only when
  the corresponding root `.env.local` or `.env.production` file exists.

## Troubleshooting

`Prisma cannot connect`: verify Docker is running, port `5433` is available,
and both database URLs point to the same intended database.

`CORS blocked`: add the exact browser origin (scheme, host, and port) to the
comma-separated `CORS_ALLOWED_ORIGINS`; paths are invalid.

`Signed in but /auth/me is unauthorized`: confirm the web and API are HTTPS
hosts on the same registrable domain. Separate platform domains are treated as
cross-site and the strict session cookie is not sent.

`Sign-in code not delivered`: verify the Resend API key, verified sender domain,
and API logs. The API intentionally does not return OTPs in responses or logs.

`GST verification unavailable`: configure `GST_API_KEY` and verify provider
connectivity. The application never substitutes synthetic GST data.

`Bootstrap refused`: an active administrator already exists, or the exact
confirmation value was not supplied. Use authenticated user management once
the first administrator exists.
