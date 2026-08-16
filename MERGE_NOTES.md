# Merge Notes: `rebranding_v1` → `staging`

**Branch produced:** `rebrand-merge-staging` (based on `origin/staging`, with `rebranding_v1` merged in)
**Goal:** bring in the frontend redesign from `rebranding_v1` without changing any backend business logic or regressing functionality staging already has deployed.
**Status:** merge conflicts resolved, `npm run check-types` passes (web + api), `next build` succeeds, `prisma validate` succeeds. **Not committed/pushed yet** — see "What to do next" at the bottom.

---

## Why this wasn't a simple merge

`rebranding_v1` was branched _before_ several features were built on `staging`:
the approvals workflow, the quote-approval flow, opportunity↔quote API integration, discount-threshold settings, etc. So a naive merge would have silently overwritten working `staging` logic with older/duplicate logic from `rebranding_v1`, or introduced backend behavior changes that were never asked for. Every conflict below was resolved by hand with one rule: **staging's business logic and data/API behavior wins; `rebranding_v1` only contributes visual/styling changes.**

---

## Backend changes — what actually changed and why

Only two backend things changed relative to `staging`, both deliberate:

1. **`apps/api/src/controllers/approval.controller.ts`** — added a single in-app notification call (`createNotification(...)`) right after an approval request is created. Nothing else in this file changed; the existing-approval check, the transaction, the email notification, and the resubmission-after-DRAFT-reset behavior are all byte-for-byte staging's.
2. **New, additive Notifications feature** (you approved keeping this — it doesn't touch any existing logic):
   - `packages/db/prisma/migrations/20260503103103_add_notifications/` — new `notifications` table + `NotificationType` enum, purely additive.
   - `packages/db/prisma/schema.prisma` — added the `Notification` model + `User.notifications` relation.
   - `apps/api/src/controllers/notification.controller.ts`, `apps/api/src/routes/notification.routes.ts` — new, scoped to `req.user.id` throughout.
   - `apps/api/src/routes/index.ts` — mounts `/api/notifications`.
   - `apps/web/hooks/useNotifications.ts`, `apps/web/components/notification-dropdown.tsx` — new bell dropdown in the header.

### Backend changes that were found and deliberately reverted/dropped

While setting this up, `git merge` initially pulled in things that **would** have changed business logic. These were caught and removed:

- **A DB unique constraint** rebranding_v1 added on `ApprovalProcess(targetObjectName, targetRecordId)` (`@@index` → `@@unique` in `schema.prisma`), plus a migration (`20260503120000_one_approval_per_record`) that deletes "duplicate" approval rows and enforces "one approval per record, ever." This directly conflicts with staging's existing, deliberate design (commit `c6a65d5`) which allows a quote to be resubmitted for approval after being reset to DRAFT. **Reverted** — schema kept as `@@index`, migration deleted, and `approval.controller.ts`'s existing-approval check is untouched (still only blocks on an existing **PENDING** approval, not on approval history).
- **`.env.example` deletion** — rebranding_v1 deleted this file. Restored from staging; it's onboarding documentation, unrelated to the redesign.
- Everything else in `apps/api/**` and `packages/db/**` (opportunity.controller.ts, quote.controller.ts, approval.routes.ts, seed.ts, etc.) is **byte-for-byte staging's version** — confirmed via `git diff --stat` against `origin/staging` after resolution (0 lines changed).

---

## Frontend architecture conflict: Opportunity approvals

`rebranding_v1` (built before the cleanup) still has a **generic** approval system that supports both `OPP` and `QUOTE` targets. Staging deliberately removed opportunity approvals entirely (commit `0537010`: "removed the opportunity approval flow ... our system is quote approval based"). Reintroducing the generic OPP/QUOTE dialog would have undone that decision. So every approval-related component below was resolved to **staging's quote-only version**:

- `apps/web/components/approvals/apply-for-approval-dialog.tsx` — kept staging's `quoteId`/`quoteNumber` props and `useSubmitQuoteForApproval` hook (not rebranding's generic `targetObjectName: "OPP"|"QUOTE"`). Added a small `Loader2` spinner on the submit button for visual polish.
- `apps/web/components/approvals/approval-detail-page.tsx` — kept staging's data hook (`useApprovalById` + `mapApiApprovalToApproval`) and the reject-with-comment dialog (rebranding's version rejected with no confirmation/comment step — a behavior change). Restyled the info grid to the icon-tile look used elsewhere in the redesign.
- `apps/web/components/approvals/approvals-table.tsx` — kept staging's column set, staging's parent-controlled pagination, and the `headerLeadingContent` slot (used to inject filters). Added colored status badges (visual only).
- `apps/web/app/sales/approvals/page.tsx` — kept staging's version wholesale. It has real functionality rebranding's didn't (server-side pagination, status/type/target filters via `nuqs` URL state) — rebranding's version was a simpler, earlier draft of this same page.
- `apps/web/hooks/useApprovals.ts` — add/add conflict (both branches wrote this file independently after diverging); kept staging's entirely.

## `useQuotes.ts` / `services.ts`: duplicate features, not real conflicts

`rebranding_v1` had independently built its own `useGenerateOrderFromQuote` / `generateOrder` / `downloadPdf`. Staging already has equivalents (`useGenerateOrder`, `quoteService.generateOrder`, `quoteService.downloadPdf`) built later with more complete behavior (loading/tooltip states, toasts). Rebranding's duplicates were dropped in both files.

**Typecheck caught one thing the automatic merge got wrong**: `apps/web/lib/api/services.ts` ended up with **two** `export const approvalService = {...}` blocks — one from each branch, in different parts of the file, so git's line-based merge didn't flag it as a conflict. Removed rebranding's duplicate block (and its now-unused `ApprovalRecord` type) and kept staging's.

## `quote-detail-page.tsx` (largest single file)

Rebranding_v1 had rewritten this file's visuals extensively but was missing functionality staging built afterward: the **Generate Order / View Order button with tooltip gating** (only enabled when `status === ACCEPTED`), the **status dropdown** (with ACCEPTED/APPROVED deliberately excluded from manual selection — this is the approval-bypass-prevention rule from commit `c6a65d5`), and the `useQuoteOrder` lookup. Final result: staging's hooks/handlers/dropdown/tooltip logic, wrapped in rebranding's icon-tile visual layout for the read-only info cards + the gradient "Grand Total" banner. Two fields staging displays that rebranding's rewritten card had silently dropped (`quote.type`, `quote.version`) were added back, along with two System-Information fields rebranding was missing (`presentedAt`, `acceptedAt`).

## `apps/web/app/sales/opportunities/[id]/page.tsx`

This file also has a real, deliberate business-logic diff in staging that had to be preserved:

- Staging **removed the Status badge/field entirely** for opportunities (it was tied to the old opportunity-approval workflow that no longer exists).
- Staging fixed a Radix `Select` bug: empty-string values aren't allowed, so it uses a `"__none__"` sentinel for the optional Type/Lead Source fields instead of `""`.
- Staging added success/error toasts on opportunity update.

Given the size of rebranding's rewrite here (~900 lines) and the risk of missing one of the above while hand-porting it, this file was kept as **staging's version wholesale**. It still inherits the rebrand's colors/fonts/nav chrome because those come from shared `packages/ui` components and `globals.css` (see below) — it just doesn't have the newer icon-tile card layout that `quote-detail-page.tsx` and `approval-detail-page.tsx` got. **Suggested follow-up** (separate, reviewable PR): re-apply the icon-tile visual treatment here using `quote-detail-page.tsx` as the reference, taking care not to reintroduce the Status field or revert the `__none__` sentinel fix.

## `data-table.tsx`

Staging added a `headerLeadingContent` prop (used by the approvals table to inject filters) — this is real, load-bearing functionality, not styling. Kept the prop, laid it out inside rebranding's restyled toolbar markup.

## Everything else

- **`packages/ui/**`(button, card, sidebar, header, donut-chart,`globals.css`, etc.)** — staging never touched any of these; 100% rebranding_v1's redesign, no risk. This is also where most of the rebrand's actual visual identity (color tokens, fonts) lives, so pages that still use the older `InfoGrid`/`InfoField` pattern (like the opportunity detail page) still pick up the new theme automatically.
- **Pages with zero staging changes** (confirmed via `git diff --stat` against the merge-base): `leads/*`, `campaigns/*`, `sales/orders/[id]`, `sales/products/[productId]`, `sales/price-books/[pricebookId]`, `account-detail-page.tsx`, `contact-detail-page.tsx`, `lead-detail-page.tsx`, `product-detail-page.tsx`. These are pure rebranding_v1 redesign, merged in as-is.
- **Pages with zero rebranding_v1 changes** (`opportunities/page.tsx` — the list page, `opportunity.controller.ts`, `quote.controller.ts`, etc.) — pure staging, untouched.
- **`next.config.js`** — kept both: staging's Windows/OneDrive symlink fix and rebranding's `unoptimized: true` for images (required — Cloudflare Workers can't run Sharp-based on-the-fly image optimization).
- **`.npmrc`** (`legacy-peer-deps=true`) — kept rebranding's value; needed to install the new Cloudflare/OpenNext tooling cleanly.
- **`.gitignore`** — added `.open-next/` and `.wrangler/` (additive).
- **`apps/web/package.json`** — additive only: adds `@opennextjs/cloudflare`, `wrangler` devDeps and `build:cf`/`preview`/`deploy` scripts. Nothing removed.
- **`package-lock.json`** — regenerated from scratch via `npm install --package-lock-only` rather than hand-merged, to guarantee consistency with the final `package.json` files.

---

## ⚠️ Cloudflare deployment config — action required before deploying

Staging's old Wrangler config lived at the wrong path (`apps/web/app/wrangler.toml`) and was in an older/incomplete format (no `main`, no `[assets]` binding, no `[vars]` — it predates the OpenNext Cloudflare adapter). Rebranding_v1 replaced it with a correct one at `apps/web/wrangler.toml` plus `apps/web/open-next.config.ts`. **Same Cloudflare project** — `account_id` (`4cef819697ac4313700e2c4b7a2ba12f`) and project `name` (`custom-marketing-crm-suite-aakraman`) are identical to the old file, so this is not a switch to a different Cloudflare account/project.

**But**: the new `apps/web/wrangler.toml` has a placeholder that must be set before deploying:

```toml
[vars]
NEXT_PUBLIC_API_URL = "https://REPLACE_WITH_PRODUCTION_API_URL"
```

If this is deployed as-is, the production frontend will try to call `https://REPLACE_WITH_PRODUCTION_API_URL` and everything will break. **Set this to the real production API origin** (either edit the file before merging, or override it via a Cloudflare dashboard/CI secret if that's how it's normally done) before running `npm run deploy` / `wrangler deploy`.

---

## What to do next

1. **Review this branch**: `rebrand-merge-staging` (currently equals `origin/staging` + `rebranding_v1` merged, all conflicts resolved, not yet committed).
2. Fix the `NEXT_PUBLIC_API_URL` placeholder in `apps/web/wrangler.toml` (see above) — required before any Cloudflare deploy.
3. Finish the merge commit:
   ```
   git commit
   ```
   (conflicts are already resolved and staged; this just finalizes the merge commit on `rebrand-merge-staging`)
4. **Manually smoke-test** before pushing anywhere important — this merge touched the quote detail page, approvals, and the opportunity detail page, which are exactly the areas with the trickiest logic:
   - Submit a quote for approval, approve it, reject one, and confirm a DRAFT-reset quote can be resubmitted (this is the specific behavior that was at risk of regressing).
   - Generate a sales order from an ACCEPTED quote; confirm "View Order" appears afterward.
   - Open an opportunity detail page and confirm editing Type/Lead Source works (the `__none__` sentinel fix).
   - Check the new notification bell in the header (should be empty until an approval request creates one).
5. Push and open a PR against `staging` (or fast-forward `staging` to this branch, whichever your team's workflow prefers) — do **not** push directly to `staging` without review, since this is a large, high-stakes merge.
6. Optional follow-up PR: re-skin `apps/web/app/sales/opportunities/[id]/page.tsx` with the icon-tile layout used on the quote/approval detail pages (see note above) — kept out of this merge to limit risk.

## Files touched during conflict resolution

Resolved by hand (business logic preserved, styling merged from `rebranding_v1`):

- `apps/api/src/routes/approval.routes.ts` (staging, unchanged)
- `apps/api/src/controllers/approval.controller.ts` (staging + 1 additive notification call)
- `packages/db/prisma/schema.prisma` (staging + additive Notification model; unique-constraint change reverted)
- `apps/web/hooks/useApprovals.ts` (staging)
- `apps/web/hooks/useQuotes.ts` (staging; dropped rebranding's duplicate)
- `apps/web/lib/api/services.ts` (staging; dropped rebranding's duplicate `approvalService`/`ApprovalRecord`)
- `apps/web/components/data-table.tsx` (staging's `headerLeadingContent` prop + rebranding's toolbar styling)
- `apps/web/components/quotes/quote-detail-page.tsx` (staging logic/hooks + rebranding visual layout)
- `apps/web/components/approvals/apply-for-approval-dialog.tsx` (staging)
- `apps/web/components/approvals/approval-detail-page.tsx` (staging logic + rebranding visual layout)
- `apps/web/components/approvals/approvals-table.tsx` (staging + status badge styling)
- `apps/web/app/sales/approvals/page.tsx` (staging)
- `apps/web/app/sales/opportunities/[id]/page.tsx` (staging, wholesale — see note above)
- `package-lock.json` (regenerated)

Deleted (business-logic change from `rebranding_v1`, out of scope):

- `packages/db/prisma/migrations/20260503120000_one_approval_per_record/`

Restored (accidentally deleted by `rebranding_v1`):

- `.env.example`
