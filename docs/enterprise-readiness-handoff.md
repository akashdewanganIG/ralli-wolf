# Enterprise-readiness audit handoff

Last updated: 2026-09-03

## Status at pause

The original repository-wide objective is **not complete**. Work was paused at
the owner's request after the principal backend, security, CRM, finance,
supply-chain, operations, and integration passes. The best evidence-based
estimate is **65–70% complete**, with **30–35% remaining**.

The unfinished portion is mainly:

1. frontend type/lint and dead-logic cleanup;
2. end-to-end browser and provider-backed workflow testing;
3. a clean repository-wide build/regression run; and
4. the final security remediation report and release decision.

This is a large, uncommitted working tree. At the time of this handoff, Git
reports 276 changed paths, approximately 17,728 insertions and 23,916
deletions. Review and checkpoint the work before beginning another broad pass.

## Current verification evidence

| Gate                        | Current result                     | Notes                                                              |
| --------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| API tests                   | 80/80 passing                      | Node test runner; no skipped or failed tests                       |
| API lint                    | Passing, zero warnings/errors      | `npm run lint -w api`                                              |
| API type check              | Passing                            | `npm run check-types -w api`                                       |
| Web type check              | Passing                            | `npm run check-types -w web`                                       |
| Web lint                    | 0 errors, 138 warnings in 49 files | Remaining work is listed below                                     |
| Dependency audit            | 0 known vulnerabilities            | `qs` was upgraded transitively to 6.16.0                           |
| Web login page smoke test   | HTTP 200                           | Verified using the clean Webpack dev path                          |
| API health smoke test       | HTTP 200, database connected       | Used temporary in-memory auth keys; see environment blockers below |
| CORS smoke test             | Passed for `http://localhost:3001` | Local origin added to the ignored root `.env`                      |
| Clean API production output | Passing                            | Stale compiled Cloudinary/deleted-module imports are gone          |

The smoke-test servers were stopped. Ports 3001 and 4000 were free at the end
of verification.

## Work completed

### Authentication and application security

- Removed the developer-login route, UI, guard, and insecure bootstrap-style
  access paths. Initial administrators are now created only by a guarded,
  one-time CLI.
- Removed public signup surfaces that did not belong in the controlled staff
  application.
- Separated JWT token families and scopes for staff sessions, MFA, password
  reset, Aakraman, and subdealer flows. Verification now enforces the intended
  algorithm and token purpose.
- Added server-side session revocation through `sessionVersion`; password
  changes, reset, credential reissue, and logout invalidate older sessions.
- Moved staff sessions to host-only, HttpOnly, SameSite=Strict cookies. Bearer
  tokens are returned only when a client explicitly opts into bearer mode.
- Hardened password reset and OTP flows against replay, concurrent redemption,
  account enumeration, leaked codes, and unlimited guessing.
- Added email/TOTP second-factor support with authenticated encryption for TOTP
  secrets and dedicated hashing material for OTPs.
- Added exact CORS origin validation, bounded proxy trust, API security headers,
  no-store responses, bounded JSON bodies, and graceful process shutdown.
- Replaced process-local-only request throttling where relevant with persisted,
  distributed rate-limit buckets.
- Added structured logging with secret/PII redaction instead of raw request,
  response, token, or provider-payload logging.
- Preserved exact raw webhook bytes and added signature verification,
  replay-digest persistence, bounded retention, and provider-specific secret
  handling.
- Restricted outbound provider URLs to approved HTTPS origins to prevent SSRF
  and credential forwarding to arbitrary hosts.
- Hardened uploads using byte-signature validation, decoded-size limits,
  collision-resistant sanitized keys, private-object references, and bounded
  signed downloads.

### CRM, users, sales, approvals, and finance

- Tightened route authorization and role/permission implications across users,
  leads, contacts, accounts, imports, exports, campaigns, sales, and settings.
- Removed mass-assignment paths and replaced them with explicit public field
  selection in user and business-record mutations.
- Normalized and validated identifiers, pagination, dates, booleans, strings,
  decimals, enums, emails, phone numbers, and import payloads without implicit
  coercion.
- Hardened lead conversion and bulk conversion responses and removed obsolete
  client hooks/services.
- Reworked account, contact, opportunity, quote, approval, sales-order, order,
  invoice, payment, and price-book request/response contracts.
- Added concurrency-safe uniqueness constraints for quote versions, primary
  quotes, one sales order per quote, and one pending approval per target.
- Added deterministic quote PDF generation so identical persisted data produces
  identical bytes and customer-visible changes alter the output.
- Added financial invariants for invoice arithmetic, dates, payment direction,
  allocations, and one-invoice-per-source-document rules.
- Updated account creation and credential reissue so passwords are never sent
  by email; users receive password-setup instructions instead.
- Finished the user-management page cleanup: payload casts were removed,
  errors now use the public API contract, and database constraint names are no
  longer expected by the UI. That page currently has zero lint warnings.

### Supply chain and operations

The supply-chain and operations modules were reached and received their main
controller/service/invariant pass. Work covered:

- inventory balances, lots, stock movements, reservations, alerts, counts, and
  valuation inputs;
- warehouse layout, bins, pallets, capacity, and utilization;
- WMS putaway, FIFO/LIFO/FEFO picking, packing, and dispatch transitions;
- material masters, consumption, wastage, shortages, and requisitions;
- BOM structure, revisions, substitutes, default/active rules, quantities,
  costs, effective dates, and component ordering;
- suppliers, purchase requisitions, purchase orders, approvals, goods receipts,
  and quality checks;
- production orders, material issue, completion, and variance inputs;
- finance integration through supplier/customer invoices, payments, and
  allocations; and
- scheduler configuration, bounded cadences, opt-in embedded execution, and
  database leases to prevent duplicate workers.

The automated suite includes strict supply-chain parsing tests for identifiers,
pagination, decimals, dates, enums, arrays, booleans, and strings. Full
database-backed workflow testing remains outstanding.

### Marketing and integrations

- Split Brevo validation, campaign orchestration, and webhook handling into
  focused services. Restricted accepted update fields and added stable delivery
  idempotency keys, strict scheduling timestamps, suppression handling, and
  official webhook-shape parsing.
- Removed obsolete Brevo scripts, payload fixtures, and duplicated integration
  documentation.
- Removed the unused Fast2SMS service and duplicate/obsolete WhatsApp scheduler,
  configuration, opt-out, and Gupshup-era code paths.
- Hardened MSG91 account, template, campaign, delivery, opt-out, webhook, and
  media handling. Credential material is excluded from API responses.
- Fixed WhatsApp phone normalization, delivery-state monotonicity, replay
  handling, private S3 media references, legacy media-object validation, and
  recipient idempotency.
- Corrected the WhatsApp campaign UI's status counts, account/template typing,
  category filtering, payload construction, sample parameters, media preview,
  and edit restrictions.
- Added strict GST provider parsing, a 1 MB response boundary, not-found versus
  unavailable outcomes, and fail-closed legal-entity validation.
- Added strict Landingi envelope parsing, field aliases, payload bounds,
  signature verification, and replay protection.

### Dead, redundant, and decorative code removed

Removed examples include:

- developer login and public signup pages/components;
- placeholder chatbot, landing-page, and toast-test routes;
- dummy opportunity, quote, and approval stores/data;
- obsolete quote line-item detail routes and local-only stores;
- duplicate order/lead/webhook hooks and a backup copy of API types;
- obsolete Fast2SMS, Cloudinary runtime dependency, Gupshup guide, webhook test
  scripts/payloads, and duplicate WhatsApp services; and
- hand-built or stale code paths superseded by shared services and API-backed
  state.

The repository still needs a final reachability/dependency scan after the
remaining frontend cleanup.

### Build and operational hygiene

- Web development now defaults to Webpack because Next.js 16.3.0 Turbopack was
  repeatedly panicking in HMR with `VersionedContents ... no longer exists`.
  Turbopack remains available as `npm run dev:turbopack -w web`.
- Added `npm run clean`, implemented by
  `scripts/clean-build-artifacts.mjs`, to delete only known generated output
  inside the repository.
- API builds now delete `apps/api/dist` before TypeScript emits. This prevents
  removed source modules from surviving in production output.
- Removed roughly 13.7 GB of generated output: root Turbo cache, live and old
  `.next` directories, workspace Turbo caches, and stale API/database builds.
  API and database distributions were rebuilt afterward.
- Updated the lockfile and cleared the remaining moderate `qs` advisory.

## Current login and database status

The active root `.env` points to a remote Supabase PostgreSQL database, not the
local PostgreSQL service. Do not treat it as disposable.

Read-only checks found:

- 9 total user rows;
- 3 active users;
- 3 active administrators;
- 3 active users with password hashes;
- 0 active TOTP enrollments.

All 70 repository migrations were applied on 2026-09-03. Prisma reports that
the database schema is up to date, and the missing `users.session_version`
login blocker is resolved. Login still requires a runtime retest.

The required authentication and email environment values are configured in the
ignored local `.env`; their contents were not logged or committed.

The ignored local `.env` was updated to allow both:

```dotenv
CORS_ALLOWED_ORIGINS="http://localhost:3001,https://ralli-wolf-web.onrender.com"
```

Before deployment, a verified logical backup was created outside the repository
at `C:\Database Backups\ralli-wolf\before-db-deploy-20260903-131838.dump`.

Do **not** run `npm run db:seed` against this database. The primary seed is
destructive. The non-destructive all-sections demo seed is intended only when
demo records are explicitly wanted on a disposable or approved development
database; it is not required to repair login.

## Applied migrations

The following migrations were applied to the configured Supabase database:

1. `20260831100000_add_session_revocation`
2. `20260831113000_link_subdealer_orders`
3. `20260831120000_add_scheduler_leases`
4. `20260831123000_add_webhook_receipts`
5. `20260831124500_add_distributed_rate_limits`
6. `20260831125500_hash_subdealer_sessions`
7. `20260901100000_add_account_profile_fields`
8. `20260901143000_add_price_book_updated_at`
9. `20260901170000_enforce_sales_document_uniqueness`
10. `20260902120000_enforce_bom_workflow`
11. `20260902123000_enforce_finance_invariants`
12. `20260902125500_add_whatsapp_processing_status`
13. `20260902130000_harden_whatsapp_campaigns`
14. `20260903090000_unique_campaign_channel_external_id`

The final migration initially found four distinct presentation campaigns that
shared sender identifiers. The migration and seed/runtime producers were fixed
to use unique campaign identities. The corrected migration was rehearsed in a
rolled-back transaction, the failed attempt was marked rolled back, and the
migration then deployed successfully. All four campaigns, 32 members, and 32
deliveries were preserved.

## Remaining frontend cleanup

Latest full web lint result: **0 errors, 138 warnings in 49 files**.

Largest remaining clusters:

| File                                                   | Warnings |
| ------------------------------------------------------ | -------: |
| `components/lead-management-dashboard.tsx`             |       14 |
| `components/subdealer-registration-form.tsx`           |        9 |
| `components/product-management.tsx`                    |        8 |
| `app/integration-manager/integration-manager-form.tsx` |        6 |
| `app/landing-page-trackers/page.tsx`                   |        6 |
| `components/edit-pricebook-entry-modal.tsx`            |        6 |
| `components/edit-lead-modal.tsx`                       |        6 |
| `components/add-pricebook-modal.tsx`                   |        6 |
| `components/add-pricebook-entry-modal.tsx`             |        6 |
| `components/add-lead-modal.tsx`                        |        6 |
| `app/sales/opportunities/[id]/page.tsx`                |        6 |
| `components/send-leads-email-modal.tsx`                |        5 |
| `components/whatsapp/edit-template-modal.tsx`          |        4 |
| `components/view-categories-modal.tsx`                 |        4 |
| `components/supply-chain/shared.tsx`                   |        3 |
| `app/(auth)/forgot-password/page.tsx`                  |        3 |

Common warning classes are explicit `any`, stale hook dependencies, unused
imports/state, and raw `<img>` elements. Each should be reviewed for behavior;
do not replace `any` with assertions solely to silence lint.

These paths contain owner-authored changes that were intentionally not
overwritten during the audit and need a careful merge if edited later:

- `apps/web/components/login-form.tsx`
- `apps/web/app/sales/price-books/page.tsx`
- `apps/web/components/add-pricebook-modal.tsx`

The last two account for seven of the remaining warnings.

## Runtime verification still required

Static checks and unit tests are not proof that every module works with real
data. After migration deployment, verify at least these workflows against a
non-production database:

1. administrator login, email OTP, TOTP setup/verification/removal, logout,
   password change, forgotten password, expired/replayed codes, and session
   revocation;
2. user creation, custom permissions, invitation resend, import/export, soft
   deletion, and ownership/reassignment restrictions;
3. lead/contact/account CRUD, assignment, qualification, conversion, bulk
   operations, search, pagination, and transfer authorization;
4. opportunity to quote to approval to sales-order progression, including
   concurrent/repeated actions and deterministic PDF delivery;
5. price-book, product, order, invoice, payment, allocation, and overdue/status
   transitions;
6. warehouse setup, stock receipt/movement/reservation/count, putaway, pick,
   pack, dispatch, material requisition, BOM approval, purchase requisition,
   purchase order, GRN/QC, production issue/completion, and financial posting;
7. subdealer registration/login, OTP, session revocation, invoice upload, and
   order creation without trusting a caller-supplied subdealer ID;
8. WhatsApp account/template/campaign/media/opt-out/provider-callback behavior
   using a provider sandbox or controlled test account;
9. Brevo campaign lifecycle and signed webhook behavior using a controlled
   test account;
10. Landingi, GST, S3, Resend, scheduled-job lease/failover, and deployment
    health behavior; and
11. negative authorization tests for every role and sensitive endpoint.

## Recommended continuation order

1. Checkpoint or back up the current working tree; do not discard unrelated
   owner changes.
2. Retest login and core database-backed workflows against the migrated
   Supabase database.
3. Finish the 138 frontend warnings, starting with lead management, subdealer
   registration, and product management.
4. Repeat route/service reachability and dependency scans after cleanup; remove
   newly orphaned files and packages.
5. Run the runtime workflow matrix above and add regression tests for every
   defect found.
6. Run the final gates from a clean build state:

   ```powershell
   npm run clean
   npm install
   npm run db:generate
   npm run check-types
   npm run lint
   npm test -w api
   npm run build
   npm audit --audit-level=moderate
   ```

7. Run `npm run db:verify:all-demo` only on a database where the approved
   all-sections demo seed has intentionally been installed.
8. Review the complete Git diff, generated migration SQL, environment examples,
   and documentation for consistency.
9. Produce the mandatory security remediation report at:

   `C:\Users\mraka\AppData\Local\Temp\codex-security-scans-5ycGLW\ralli-wolf\bbf16bca6bd116f138562a4969eb030f0a74b4ba_20260831T060905Z_7h1fqsnx\artifacts\fix_report.md`

10. Only declare the repository enterprise-ready after all gates and runtime
    workflows are evidenced, not merely because no new issue was observed.

## Useful commands

```powershell

npm run clean


npm run check-types
npm run lint


npm test -w api


cd packages/db
npx dotenv -e ../../.env -- prisma migrate status
cd ../..


npm run dev


npm run dev:turbopack -w web
```
