<div align="center">

# Innovun — Custom Marketing CRM Suite

Modern, type-safe marketing CRM built with a monorepo architecture. Includes a Next.js web app, an Express API, a shared Prisma database package, a UI component library, and shared tooling.

</div>

---

## Tech Stack

- **Monorepo**: Turborepo
- **Language**: TypeScript (Node >= 18)
- **Frontend**: Next.js 15, React 19 (`apps/web`)
- **API**: Express 5 (`apps/api`) on port `4000` by default
- **Database**: PostgreSQL + Prisma ORM (`packages/db`)
  - **Local**: PostgreSQL 15 via Docker (`docker-compose.yml`, port `5433`)
  - **Production**: Supabase Postgres (managed, SSL required)
- **UI Library**: `@repo/ui` shared components
- **Linting/Build**: ESLint 9, TypeScript 5.9, Turbo tasks
- **Formatting**: Prettier 3

## Repository Structure

```
custom-marketing-crm-suite/
  apps/
    api/                  # Express API server
      src/index.ts
    web/                  # Next.js app
      app/
  packages/
    db/                   # Prisma schema, client, seeds, switch scripts
      prisma/
        schema.prisma
        seed.ts
      switch-db.ps1 | switch-db.sh
    ui/                   # Shared UI components
    eslint-config/        # Shared ESLint configs
    typescript-config/    # Shared TS configs
  turbo.json              # Turborepo task pipeline
  docker-compose.yml      # Local Postgres service
  DEVELOPMENT_WORKFLOW.md # Daily env workflow
```

## Local Development

> **📖 New to the project?** Check out the **[Complete Local Setup Guide](./docs/LOCAL_SETUP.md)** for detailed step-by-step instructions, environment variable configuration, and troubleshooting tips.

Prerequisites:

- Node 18+
- Docker Desktop (for local PostgreSQL)
- PowerShell (Windows) for `db:switch:*` scripts

1. Install dependencies

```bash
npm install
```

2. Start local Postgres via Docker

```bash
docker-compose up -d
# Exposes Postgres on localhost:5433 with DB=innovun_crm, user=postgres, password=password
```

3. Configure environment
   Create a root `.env` with:

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5433/innovun_crm?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5433/innovun_crm?schema=public"
```

4. Generate and apply database

```bash
npm run db:generate
npm run db:deploy
npm run db:seed
```

To add a complete, non-destructive demo workspace to the currently configured
database, run:

```bash
npm run db:seed:all-demo
npm run db:verify:all-demo
```

This command creates real relational records for the CRM, campaigns, sales,
dealer ordering, inventory, materials, warehouse, BOM, production, purchasing,
quality, approvals, notifications, and settings modules. It uses stable
`DEMO-*` identifiers and can be rerun without deleting existing records or
duplicating its dataset. OTP/reset rows and live integration secrets are
intentionally excluded.

The verification command checks cross-module relationships and quantities after
the seed finishes.

5. Run apps

```bash
# Run all dev servers (un-cached, persistent)
npm run dev

# Or run individually
cd apps/api && npm run dev         # http://localhost:4000
cd apps/web && npm run dev         # http://localhost:3000
```

Useful DB scripts (from repo root):

```bash
npm run db:switch:local       # point db package to local .env
npm run db:switch:production  # point db package to production .env
npm run db:studio             # Prisma Studio
npm run db:reset              # Reset database
```

Note: Prisma CLI now loads environment from the root `.env` via `dotenv-cli` wrapping in `@repo/db` scripts.

### Switch between local and production environments (cross-platform)

Use the root scripts to swap the active `.env`:

```bash
# Use local Docker database
npm run env:switch:local

# Use production database (Supabase)
npm run env:switch:production
```

Create these files at the repo root (not committed):

```bash
# .env.local
DATABASE_URL="postgresql://postgres:password@localhost:5433/innovun_crm?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5433/innovun_crm?schema=public"

# .env.production (Supabase example placeholders)
DATABASE_URL="postgresql://USER:PASSWORD@db.<project-ref>.supabase.co:5432/postgres?sslmode=require&schema=public"
DIRECT_URL="postgresql://USER:PASSWORD@db.<project-ref>.supabase.co:5432/postgres?sslmode=require&schema=public"
```

## Common Scripts

From repository root:

- `npm run dev`: run all apps in dev
- `npm run build`: build all apps/packages
- `npm run lint`: lint all packages
- `npm run check-types`: type-check all packages
- `npm run db:*`: proxy Prisma tasks to `@repo/db`
- `npm run db:seed:all-demo`: upsert complete cross-module demo data
- `npm run db:verify:all-demo`: verify the persisted demo dataset

From `apps/web`:

- `npm run dev` (Next.js on port 3000)
- `npm run build`, `npm run start`, `npm run lint`, `npm run check-types`

From `apps/api`:

- `npm run dev` (Express ts-node-dev)
- `npm run build` (tsc), `npm start` (node dist)

From `packages/db`:

- `npm run prisma:generate|migrate|deploy|seed|studio|reset`

## Environment Configuration

Create a root `.env` file (use `.env.example` as template) with the following key configurations:

### Required Variables

**Database (PostgreSQL):**

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5433/innovun_crm?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5433/innovun_crm?schema=public"
```

**Authentication & Security:**

```bash
JWT_SECRET="your-super-secret-jwt-key-change-me-in-production"
JWT_EXPIRES_IN="24h"
ENCRYPTION_KEY="your-32-character-encryption-key-here"
```

**Server Configuration:**

```bash
PORT=4000
NODE_ENV="development"
```

**Frontend (Next.js):**

```bash
NEXT_PUBLIC_COMPANY_NAME="InnoCRM"
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

### Optional Integrations

**AWS S3 (for WhatsApp media):**

```bash
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="ap-southeast-2"
S3_BUCKET_NAME="your-bucket-name"
```

See [docs/WHATSAPP_S3_SETUP.md](./docs/WHATSAPP_S3_SETUP.md) for detailed setup.

**MSG91 (WhatsApp & SMS):**

```bash
MSG91_BASE_URL="https://control.msg91.com/api/v5"
MSG91_AUTH_KEY="your-msg91-auth-key"
```

**Email (Plunk):**

```bash
PLUNK_API_KEY="your-plunk-api-key"
PLUNK_FROM_EMAIL="no-reply@yourdomain.com"
```

**Developer Access:**

```bash
DEVELOPER_LOGIN_EMAIL="developer@innovun.com"
DEVELOPER_LOGIN_PASSWORD="admin123"
```

For a complete list of environment variables with descriptions, see [`.env.example`](./.env.example).

### Environment Loading Behavior

- **Prisma** (via `@repo/db` scripts): Loads from ROOT `.env` using `dotenv-cli`
  - Applies to: `db:generate`, `db:migrate`, `db:deploy`, `db:reset`, `db:studio`, `db:seed`
- **Next.js** (`apps/web`): Uses Next.js env conventions
  - Client-exposed vars must be prefixed with `NEXT_PUBLIC_`
  - Supports: `.env`, `.env.local`, `.env.development`, `.env.production` (later files override earlier)
- **API** (`apps/api`): Loads via `dotenv.config()` from working directory
  - Ensure `DATABASE_URL` is set for runtime DB access

## Contribution Guidelines

1. Branching
   - Create feature branches from `staging`: `feat/...`, `fix/...`, `chore/...`
2. Commits
   - Use concise, imperative messages: "feat(api): add leads endpoint"
3. Code Style
   - TypeScript, strict types; match existing formatting
   - Run `npm run lint` and `npm run check-types` before pushing
4. Database Changes
   - Edit `packages/db/prisma/schema.prisma`
   - Run `npm run db:migrate` for iterative dev migrations
   - Run `npm run db:deploy` for applying migrations
   - Provide seeds in `prisma/seed.ts` when needed
5. Testing locally
   - Ensure Docker Postgres is running and seed data is loaded
6. PRs
   - Link issue, describe scope, include screenshots for UI

## API Endpoints

The API includes the following route modules (see [Postman Collection](./docs/postman/) for complete API documentation):

**Core Modules:**

- **Authentication**: `/api/auth` - Login, signup, password reset, developer access
- **Users**: `/api/users` - User management and profiles
- **Accounts**: `/api/accounts` - Account/organization management

**CRM & Lead Management:**

- **Leads**: `/api/leads` - Lead creation, updates, filtering, bulk operations
- **Contacts**: `/api/contacts` - Contact management
- **Segments**: `/api/segments` - Customer segmentation

**Sales & Commerce:**

- **Sales**: `/api/sales` - Sales pipeline and tracking
- **Products**: `/api/product` - Product catalog
- **Product Categories**: `/api/productCategory` - Product categorization
- **Orders**: `/api/order` - Order management
- **Invoices**: `/api/invoice` - Invoice generation and tracking
- **Subdealers**: `/api/subdealer` - Subdealer registration and management

**Marketing & Campaigns:**

- **Campaigns**: `/api/campaigns` - Marketing campaign management
- **WhatsApp**: `/api/whatsapp` - WhatsApp campaigns and messaging
- **Landing Pages**: `/api/landingPageCampaign` - Landing page campaign tracking
- **Keywords**: `/api/keywords` - Keyword tracking for campaigns

**Analytics & Reporting:**

- **Analytics**: `/api/analytics` - Event tracking and analytics data
- **Dashboard**: `/api/dashboard` - Dashboard metrics and KPIs
- **Exports**: `/api/exports` - Data export functionality

**Supply Chain** (see [docs/SUPPLY_CHAIN_MODULES.md](./docs/SUPPLY_CHAIN_MODULES.md)):

- **Inventory**: `/api/inventory` - Real-time stock, lots, ledger, alerts, reorder policies, counts, valuation
- **Materials**: `/api/materials` - Material master, BOM availability, shortages, consumption & wastage, requisitions
- **Warehouses**: `/api/warehouses` - Warehouses, zones, racks/bins, pallets, storage utilisation
- **WMS**: `/api/wms` - Putaway, picking (FIFO/LIFO/FEFO), packing, dispatch
- **BOM**: `/api/boms` - Multi-level bills of materials, substitutes, cost roll-up, revisions
- **Suppliers**: `/api/suppliers` - Vendor master, catalogue pricing, performance scorecards
- **Purchasing**: `/api/purchase-requisitions`, `/api/purchase-orders` - Requisitions, POs, approvals
- **Goods Receipts**: `/api/goods-receipts` - GRN and QC inspection
- **Production**: `/api/production-orders` - Production orders, material issue, variance

**Integrations:**

- **Brevo**: `/api/brevo` - Email marketing via Brevo
- **Integrations**: `/api/integrations` - Third-party integrations management
- **Webhooks**: `/api/webhooks` - Webhook endpoints for external services
- **Aakraman**: `/api/aakraman` - Aakraman integration

For detailed endpoint documentation, request/response schemas, and testing examples, refer to the [Postman collection](./docs/postman/crm-backend.postman_collection.json) and [API testing guide](./docs/postman/README.md).

## Troubleshooting

- Postgres connection errors: verify Docker is up and port `5433` is not in use
- Prisma errors: re-run `npm run db:generate` and `npm run db:deploy`
- Type errors: run `npm run check-types` in root and per-app

For more detailed troubleshooting, see [docs/LOCAL_SETUP.md](./docs/LOCAL_SETUP.md).

## Documentation

This project includes comprehensive documentation for various aspects:

### Setup & Configuration

- **[Local Setup Guide](./docs/LOCAL_SETUP.md)** - Complete guide for setting up the project locally
- **[Supply Chain Modules](./docs/SUPPLY_CHAIN_MODULES.md)** - Inventory, Material, Warehouse, BOM and Purchasing: setup, design decisions, API reference
- **[WhatsApp S3 Setup](./docs/WHATSAPP_S3_SETUP.md)** - Setting up S3 for WhatsApp campaigns
- **[API Documentation](./docs/postman/)** - Postman collection and API testing guide

### Future Plans

- **[Future Scope](./docs/FUTURE_SCOPE.md)** - Planned features and roadmap

## License

Private project. All rights reserved.
