# Supply Chain Modules

Five modules — Inventory, Material Management, Warehouse Management, Bill of
Materials, and Purchasing & Supplier Management — integrated into the existing
CRM rather than bolted alongside it.

---

## Contents

- [What was added](#what-was-added)
- [How it integrates with the existing CRM](#how-it-integrates-with-the-existing-crm)
- [Setup](#setup)
- [Design decisions that matter](#design-decisions-that-matter)
- [Module reference](#module-reference)
- [API reference](#api-reference)
- [Configuration](#configuration)
- [Background jobs](#background-jobs)
- [Operational notes](#operational-notes)

---

## What was added

| Layer              | Location                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Data model         | `packages/db/prisma/schema.prisma` — 41 new tables, 30 new enums                                                            |
| Migration          | `packages/db/prisma/migrations/20260808120000_add_supply_chain_modules/`                                                    |
| Reference seed     | `packages/db/prisma/seed-supply-chain.ts` (idempotent, production-safe)                                                     |
| Domain services    | `apps/api/src/services/supplyChain/`                                                                                        |
| Controllers        | `apps/api/src/controllers/{inventory,material,warehouse,wms,bom,supplier,purchasing,goodsReceipt,production}.controller.ts` |
| Routes             | `apps/api/src/routes/supply-chain.routes.ts`, mounted in `routes/index.ts`                                                  |
| Scheduled jobs     | `apps/api/src/jobs/inventory-scheduler.ts`                                                                                  |
| Web types/services | `apps/web/lib/api/types/supply-chain.ts`, `apps/web/lib/api/supply-chain-services.ts`                                       |
| Web hooks          | `apps/web/hooks/use-supply-chain.ts`                                                                                        |
| Web pages          | `apps/web/app/{inventory,materials,warehouse,bom,purchasing,production}/` — 34 routes                                       |
| Navigation         | `apps/web/components/app-sidebar.tsx`                                                                                       |

---

## How it integrates with the existing CRM

These modules extend what is already there instead of duplicating it:

- **One item master.** `Product` gained supply-chain attributes (`itemType`,
  `uomId`, `trackingType`, `pickingStrategy`, `valuationMethod`,
  `shelfLifeDays`, `standardCost`, `isPurchasable`, `isStockTracked`, …). Sales
  and purchasing quote the _same_ catalogue; there is no parallel item list to
  drift out of sync. All new columns are optional or defaulted, so existing
  product records and queries are unaffected.

- **One approval queue.** Purchase orders route through the existing
  `ApprovalProcess` model. `ApprovalTargetObject` gained `PURCHASE_ORDER`, and
  `approval.controller.ts` now handles it, so a PO approval appears in the same
  `/sales/approvals` inbox, sends the same email, and writes the same audit
  trail as an opportunity or quote approval.

- **One notification stream.** `NotificationType` gained `STOCK_ALERT`,
  `PURCHASE_ORDER_APPROVED`, `PURCHASE_ORDER_REJECTED`, `GOODS_RECEIVED`,
  `QC_FAILED` and `MATERIAL_SHORTAGE`. They surface in the existing bell
  dropdown with no client changes.

- **One audit log.** `AuditCategory` gained `INVENTORY_MANAGEMENT`,
  `WAREHOUSE_MANAGEMENT`, `PROCUREMENT`, `BOM_MANAGEMENT` and `PRODUCTION`.

- **Sales orders feed the warehouse.** `POST /api/wms/pick-lists` accepts a
  `salesOrderId` and pulls its line items directly.

- **Existing settings screen.** Alert tuning lives in `global_settings`, which
  the Settings page already reads and writes.

---

## Setup

### 1. Start the database

```bash
docker-compose up -d          # Postgres 15 on localhost:5433
```

### 2. Apply the migration

```bash
npm run db:generate
npm run db:deploy             # applies 20260808120000_add_supply_chain_modules
```

The migration is additive. It creates new tables, adds optional columns to
`products`, and appends values to three existing enums. **No existing column is
dropped or retyped, and no existing row is modified.**

### 3. Seed reference data

```bash
npm run db:seed:supply-chain
```

Idempotent and non-destructive — safe to run against production and safe to
re-run. It seeds:

- **25 units of measure** with real conversion factors to a base unit per
  category (EA, KG, M, L, M², HR).
- **15 document number sequences** (PO, GRN, MOV, LOT, …).
- **3 tunable settings** for the alert engine.

It deliberately seeds **no** warehouses, suppliers, stock, prices or BOMs.
Those are business records that must come from you — the UI shows a guided
empty state instead of demo data, so nothing in a report is ever a placeholder.

> `npm run db:seed` (the destructive development seed) now also calls this, and
> clears supply-chain tables in FK-safe order first. Without that it would fail
> at `user.deleteMany()` once any supply-chain row referenced a user.

### 4. Run

```bash
npm run dev
```

### 5. First-run checklist

The modules need real master data before they do anything useful:

1. **Warehouse → Warehouses & Bins** — create a warehouse, then a `RECEIVING`
   zone and a `STORAGE` zone, then bins (use _Generate a rack layout_ for bulk).
   A warehouse with no active bin cannot receive stock, and the API says so
   rather than inventing a location.
2. **Products** — set `itemType`, unit of measure, and `isPurchasable` /
   `isStockTracked` on the items you want tracked.
3. **Purchasing → Suppliers** — add suppliers and their catalogue prices.
4. **Inventory → Reorder Policies** — set safety stock and reorder points.
   Without a policy the alert engine has no threshold to watch and will not
   warn about a stockout.
5. **BOM** — build structures for items you manufacture, then activate them.

---

## Design decisions that matter

**Decimal arithmetic everywhere.** Quantities and money are Postgres `numeric`,
handled server-side as `Prisma.Decimal` and sent to the browser as _strings_.
No stock or money value passes through a JavaScript `number`. Use
`lib/utils/decimal.ts` to format for display; never round-trip a converted
number back to the server.

**Lot-level cost layers.** Every receipt creates a `StockLot` carrying its own
unit cost, expiry and batch/serial identity. FIFO, LIFO and FEFO consume those
layers in the item's configured order, so cost of goods issued is exact rather
than an average applied afterwards. Valuation is the sum of what is on hand at
what it actually cost — there is no cached total to drift.

**An immutable ledger.** Every change to `stock_balances` writes a
`stock_movements` row. On-hand can always be reconciled against history; the
end-to-end test asserts exactly this and it holds to the fourth decimal place.

**Concurrency is handled, not hoped for.** Read-modify-write on a balance is not
safe on its own: two transactions can both read 10 on hand and both issue 8.
Every mutation takes a transaction-scoped advisory lock on `(productId,
warehouseId)`, and multi-line documents acquire locks in ascending product order
so they cannot deadlock against each other. _Verified_: 20 concurrent
transactions issuing 10 units each against 100 on hand → exactly 10 succeed, 10
are cleanly rejected, the balance lands on 0, and nothing goes negative.

**Gapless, collision-free document numbers.** The `number_sequences` table is
bumped by a single `INSERT … ON CONFLICT DO UPDATE … RETURNING` inside the
document's own transaction. This replaces the "read the highest number and add
one" pattern used elsewhere in the codebase, which races under load. Counters
reset per period (yearly by default) and prefixes are editable in the database.

**Integrity enforced in the database.** Rules Prisma's schema language cannot
express are hand-written in the migration and, because they are CHECK
constraints or partial/expression indexes, the migration engine leaves them
alone on later runs:

| Rule                                      | Mechanism                                                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| One row per physical stock slot           | `UNIQUE (product, warehouse, bin, lot, COALESCE(pallet,0))` — plain UNIQUE would let two "no pallet" rows split the quantity |
| Reservations never negative               | CHECK on `stock_balances.reserved_quantity`                                                                                  |
| Lots never over-consumed                  | CHECK on `stock_lots.remaining_quantity`                                                                                     |
| Ledger rows carry a positive magnitude    | CHECK on `stock_movements.quantity`                                                                                          |
| At most one default warehouse             | partial UNIQUE index                                                                                                         |
| At most one default BOM per product       | partial UNIQUE index                                                                                                         |
| One OPEN alert per product/warehouse/type | partial UNIQUE index — lets the alert engine re-run on a schedule without flooding the queue                                 |

**Nothing is assumed.** Where a figure cannot be derived, the system asks rather
than guesses:

- A write-on adjustment requires a unit cost — booking inventory value out of
  thin air is not an option.
- A purchase line with no price and no supplier catalogue entry is rejected
  with `PRICE_NOT_FOUND`.
- A batch-tracked item cannot be received without a batch number; a
  serial-tracked one needs one serial per unit.
- A supplier with no receipts in the period reports `hasData: false` and the UI
  shows "Not rated" — an unrated supplier is not the same as a bad one.
- A cost roll-up lists components missing a standard cost instead of silently
  treating them as free.

---

## Module reference

### 1. Inventory Management

Real-time stock across every location, with automated updates from purchase,
sales and internal movement.

- `StockLot` — cost/expiry layer per receipt. `StockBalance` — on-hand per
  (product, warehouse, bin, lot, pallet). `StockMovement` — the ledger.
- `StockReservation` — soft allocation; raises `reserved_quantity` so the same
  units cannot be promised twice. Available = on hand − reserved.
- `ReorderRule` — safety stock, reorder point, reorder quantity, max stock,
  lead time, optional auto-requisition and preferred supplier.
- `StockAlert` — `STOCKOUT`, `BELOW_SAFETY_STOCK`, `REORDER_POINT`,
  `OVERSTOCK`, `EXPIRY_WARNING`, `EXPIRED`, `NEGATIVE_STOCK`.
- `StockCount` / `StockCountLine` — cycle counting; opening a count snapshots
  the system quantity so variance is measured against a fixed baseline, and
  posting writes the variance to stock through the normal movement engine.

The alert engine compares **projected** stock (free + already on order) against
thresholds, because raising a purchase alert for something a supplier is
already shipping is how buyers double-order. It is idempotent and resolves
alerts automatically once a position recovers.

**UI:** `/inventory` · `/inventory/stock` · `/inventory/stock/[productId]` ·
`/inventory/movements` · `/inventory/alerts` · `/inventory/reorder-rules` ·
`/inventory/counts` · `/inventory/valuation`

### 2. Material Management

Raw materials, components, consumables and packaging.

- Materials are `Product` rows with `itemType` in `RAW_MATERIAL`, `COMPONENT`,
  `CONSUMABLE`, `PACKAGING`.
- **Availability check** explodes a BOM to its leaves, sums demand for a
  component appearing in several branches, and compares against free stock —
  reporting shortfall, shortfall-after-incoming, coverage %, the largest whole
  build the stock supports, and approved substitutes with how much of the
  original each could cover.
- `MaterialRequisition` — request and issue from stores. Consumption and
  wastage are separated **at the point of issue**, which is what makes the
  wastage report a fact rather than a variance-derived guess.
- Consumption report: consumed / scrapped / expired quantity and value per
  material, with a wastage percentage, all from posted ledger rows.

**UI:** `/materials` · `/materials/availability` · `/materials/shortages` ·
`/materials/consumption` · `/materials/requisitions`

### 3. Warehouse Management (WMS)

- `Warehouse` → `WarehouseZone` → `StorageBin`, plus `Pallet` (LPN) tracking.
  Bins carry aisle/rack/level/position, a traversal `pickSequence`, weight and
  volume capacity, and pick-face / receiving / shipping / quarantine flags.
- **Rack generator** creates a whole layout with consistent codes and a
  _serpentine_ pick sequence, so a picker walks up one aisle and down the next.
- **Putaway suggestions** rank bins explainably: a bin already holding the item
  (consolidation) → a pick face → the emptiest bin in traversal order. Bins
  that physically cannot take the weight are filtered out, not scored down.
- **Pick lists** allocate across bins in the item's strategy order, reserve as
  they go, and sequence tasks by bin traversal order. **Packing** can only pack
  what was actually picked. Shipping closes the list.
- FIFO / LIFO / FEFO and batch/serial tracking are honoured throughout.

**UI:** `/warehouse` · `/warehouse/[id]` (zones, bins, utilisation, pallets) ·
`/warehouse/putaway` · `/warehouse/pick-lists` · `/warehouse/packages`

### 4. Bill of Materials

- `BillOfMaterials` → `BomComponent` → `BomComponentSubstitute`, plus
  `BomChangeLog`.
- **Multi-level explosion** walks sub-assemblies that have their own active
  BOM. Scrap percentage inflates demand at each level and **compounds down the
  tree** — a 2% loss on a sub-assembly really does cost more raw material than
  2% at the top. Phantom assemblies are exploded through without being stocked.
- **Circular references are impossible.** A breadth-first check rejects a
  component before it is saved, and the explosion carries a visiting-set so a
  cycle becomes a clear error rather than a stack overflow.
- **Cost roll-up** recurses: a manufactured component contributes its own
  rolled-up cost, not its standard cost.
- **Revisions**: an ACTIVE BOM is frozen. Revising copies the whole structure to
  a new version linked to the one it supersedes, so historic production orders
  still reference what was actually built. Activating a new version retires the
  old one automatically.
- **Where-used** shows every BOM consuming an item, as component or substitute.

**UI:** `/bom` · `/bom/[id]` (structure, explosion, costing, change history)

### 5. Purchase Order & Supplier Management

- `Supplier` + `SupplierContact` + `SupplierProduct` (catalogue) +
  `SupplierPriceTier` (quantity breaks) + `SupplierPerformance`.
- **Vendor pricing** is date-effective. Saving a new price closes the previous
  open one, so the history of what was agreed and when stays intact. Quantity
  breaks win over the header price. A price comparison endpoint ranks every
  supplier who quotes an item today.
- `PurchaseRequisition` → `PurchaseOrder` → `GoodsReceiptNote` → `QualityCheck`.
  Converting a requisition skips lines already ordered, so converting twice
  cannot double-order.
- **Approvals** use the CRM's existing approval process (see above).
- **GRN**: over-receipt beyond the ordered quantity is rejected outright.
  Posting is a separate step so QC can sit in between; only the **accepted**
  quantity becomes stock, at the price actually paid. Posting is idempotent per
  line, so a retried request cannot double-count a receipt.
- **QC** parameters with numeric limits are checked against the observed
  reading, so pass/fail is derived rather than asserted.
- **Supplier performance** — on-time delivery, quality acceptance, fill rate,
  average lead time, price variance, and a weighted score. Every figure comes
  from posted POs and GRNs; the weighting is exposed so the UI can explain the
  number instead of showing an opaque rating.

**UI:** `/purchasing` · `/purchasing/suppliers` · `/purchasing/suppliers/[id]` ·
`/purchasing/requisitions` · `/purchasing/orders` · `/purchasing/orders/[id]` ·
`/purchasing/goods-receipts` · `/purchasing/quality`

### Production (supporting module)

`ProductionOrder` ties BOM → material issue → finished-goods receipt, which is
what makes consumption-vs-standard and wastage reporting real. The BOM is
exploded and **frozen onto the order at creation**, so a later revision cannot
rewrite what a run was meant to consume. Finished goods are costed from material
actually consumed plus the BOM's labour and overhead.

**UI:** `/production` · `/production/[id]`

---

## API reference

All routes require authentication and an `ADMIN` or `SYSTEM_ADMIN` role.
Errors follow the existing `{ error, code, details? }` shape.

<details>
<summary><strong>Warehouses</strong> — <code>/api/warehouses</code></summary>

| Method   | Path                              |
| -------- | --------------------------------- |
| GET/POST | `/`                               |
| GET/PUT  | `/:id`                            |
| GET/POST | `/:id/zones`                      |
| GET/POST | `/:id/bins`                       |
| POST     | `/:id/bins/bulk` (rack generator) |
| PUT      | `/bins/:binId`                    |
| GET      | `/:id/utilisation`                |
| GET/POST | `/:id/pallets`                    |
| PATCH    | `/pallets/:palletId/move`         |

</details>

<details>
<summary><strong>Inventory</strong> — <code>/api/inventory</code></summary>

| Method   | Path                                                                                |
| -------- | ----------------------------------------------------------------------------------- |
| GET      | `/dashboard`, `/valuation`, `/units`                                                |
| GET      | `/stock`, `/stock/:productId`, `/movements`, `/lots`                                |
| POST     | `/receipts`, `/adjustments`, `/transfers`                                           |
| GET      | `/alerts` · POST `/alerts/evaluate`                                                 |
| PATCH    | `/alerts/:id/acknowledge`, `/alerts/:id/resolve`                                    |
| GET/PUT  | `/reorder-rules` · DELETE `/reorder-rules/:id`                                      |
| GET/POST | `/counts` · GET `/counts/:id` · PATCH `/counts/:id/lines` · POST `/counts/:id/post` |

</details>

<details>
<summary><strong>Materials</strong> — <code>/api/materials</code></summary>

| Method   | Path                                                         |
| -------- | ------------------------------------------------------------ |
| GET      | `/`, `/consumption`, `/shortages`                            |
| POST     | `/availability`                                              |
| GET/POST | `/requisitions` · GET `/requisitions/:id`                    |
| POST     | `/requisitions/:id/issue` · PATCH `/requisitions/:id/cancel` |

</details>

<details>
<summary><strong>WMS</strong> — <code>/api/wms</code></summary>

| Method   | Path                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| GET      | `/dashboard`, `/putaway-suggestions`, `/putaway-tasks`, `/packages`           |
| PATCH    | `/putaway-tasks/:id/assign` · POST `/putaway-tasks/:id/complete`              |
| GET/POST | `/pick-lists` · GET `/pick-lists/:id`                                         |
| PATCH    | `/pick-lists/:id/release`, `/pick-lists/:id/cancel`                           |
| POST     | `/pick-lists/:id/packages`, `/pick-lists/:id/ship`, `/pick-tasks/:id/confirm` |

</details>

<details>
<summary><strong>BOM</strong> — <code>/api/boms</code></summary>

| Method     | Path                                                                         |
| ---------- | ---------------------------------------------------------------------------- |
| GET/POST   | `/` · GET/PUT `/:id` · PATCH `/:id/status`                                   |
| POST       | `/:id/components`, `/:id/components/bulk`, `/:id/cost-rollup`, `/:id/revise` |
| PUT/DELETE | `/components/:componentId`                                                   |
| POST       | `/components/:componentId/substitutes` · DELETE `/substitutes/:substituteId` |
| GET        | `/:id/explode`, `/:id/history`, `/where-used/:productId`                     |

</details>

<details>
<summary><strong>Suppliers & purchasing</strong></summary>

| Method   | Path                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| GET/POST | `/api/suppliers` · GET/PUT `/api/suppliers/:id`                                                                |
| GET      | `/api/suppliers/scorecards`, `/api/suppliers/delivery-watchlist`, `/api/suppliers/price-comparison/:productId` |
| POST     | `/api/suppliers/:id/contacts` · DELETE `/api/suppliers/contacts/:contactId`                                    |
| GET/POST | `/api/suppliers/:id/catalogue` · DELETE `/api/suppliers/catalogue/:entryId`                                    |
| GET/POST | `/api/suppliers/:id/performance`, `/api/suppliers/:id/performance/snapshot`                                    |
| GET/POST | `/api/purchase-requisitions` · GET `/:id` · PATCH `/:id/status` · POST `/:id/convert`                          |
| GET/POST | `/api/purchase-orders` · GET `/dashboard` · GET/PUT `/:id` · POST `/:id/submit` · PATCH `/:id/status`          |
| GET/POST | `/api/goods-receipts` · GET `/:id` · POST `/:id/post` · PATCH `/:id/cancel`                                    |
| POST     | `/api/goods-receipts/lines/:lineId/quality-check` · GET `/api/goods-receipts/quality-checks`                   |
| GET/POST | `/api/production-orders` · GET `/:id`, `/:id/availability`, `/:id/variance`                                    |
| POST     | `/api/production-orders/:id/release`, `/:id/complete` · PATCH `/:id/cancel`                                    |

</details>

---

## Configuration

Editable from **Settings** (stored in `global_settings`):

| Key                                  | Default              | Effect                                                                                                 |
| ------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------ |
| `inventory.expiry_warning_days`      | `30`                 | Days before expiry an `EXPIRY_WARNING` is raised                                                       |
| `inventory.alert_notify_roles`       | `SYSTEM_ADMIN,ADMIN` | Roles notified in-app about new alerts                                                                 |
| `inventory.auto_requisition_enabled` | `true`               | Master switch for automatic requisitions (each item still needs `autoRequisition` on its reorder rule) |

The reorder and expiry sweep runs every 15 minutes, and expired reservations
are released every hour. These fixed service cadences are defined next to the
scheduler logic.

---

## Background jobs

Started by `apps/api/src/index.ts` alongside the existing WhatsApp scheduler:

- **Reorder alert sweep** — re-evaluates every active reorder rule and expiry
  window, resolves recovered positions, raises automatic requisitions, and
  notifies. Guarded against overlapping runs; idempotent, so a manual
  evaluation from the UI at the same time is harmless.
- **Reservation expiry sweep** — releases stock held by reservations past their
  `expiresAt`, so a forgotten document does not lock inventory away forever.

`snapshotMonthlySupplierPerformance()` is exported for a monthly cron if you
want fixed scorecard history; the live scorecard endpoint works without it.

---

## Operational notes

**Tune the alert sweep to your catalogue.** The 15-minute default suits a few
hundred SKUs. Tens of thousands should use a longer interval or a dedicated
worker — the sweep evaluates each rule with its own availability query.

**Negative stock is opt-in per warehouse.** `allowNegativeStock` defaults to
off. When enabled, an over-issue still posts to the ledger (so balances and
history agree) against a zero-value layer, and a `NEGATIVE_STOCK` alert makes it
visible. Leave it off unless a specific site needs it.

**Deactivating a warehouse holding stock is blocked** with `409
WAREHOUSE_HAS_STOCK`. Move or write the stock off first.

**Posting a receipt is irreversible by design.** To back one out, use a purchase
return or a stock adjustment with a reason code — both leave an audit trail,
whereas deleting the GRN would not.

**The `resetSupplyChainData()` helper** in `seed-supply-chain.ts` deletes
supply-chain transactional data in FK-safe order. The destructive dev seed uses
it. The helper itself enforces the non-production, destructive-action, and exact
database-target confirmations, so importing it cannot bypass those guards.

---

## Verification performed

| Check                                                         | Result                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma validate`                                             | Schema valid                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `prisma generate`                                             | Client generated                                                                                                                                                                                                                                                                                                                                                                                                              |
| Migration replay — all 43 migrations against a clean Postgres | Applied cleanly; 41 supply-chain tables, 5 custom indexes, 5 CHECK constraints present                                                                                                                                                                                                                                                                                                                                        |
| Integrity rules exercised                                     | Duplicate stock slot, negative reserved, over-consumed lot, second default warehouse, duplicate open alert — all rejected                                                                                                                                                                                                                                                                                                     |
| Document numbering                                            | 5 sequential numbers issued with no duplicates; year rollover resets the counter                                                                                                                                                                                                                                                                                                                                              |
| API typecheck + build (`tsc`)                                 | Clean                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Web typecheck + `next build`                                  | Clean; all 34 new routes compiled                                                                                                                                                                                                                                                                                                                                                                                             |
| API runtime smoke test                                        | All 29 route groups mounted, return 401 unauthenticated (not 404); unknown route returns 404                                                                                                                                                                                                                                                                                                                                  |
| End-to-end business flow against real Postgres                | **75 assertions passed, 0 failed** — covering vendor price breaks, BOM explosion with compounding scrap, cost roll-up, PO → GRN → QC → post, over-receipt rejection, FIFO and FEFO layer selection, putaway, reservations, availability with substitutes, production issue/scrap/variance, pick → pack → ship, reorder alerts with auto-requisition and idempotency, supplier scorecard, and ledger-to-balance reconciliation |
| Concurrency stress test                                       | **11 assertions passed, 0 failed** — 20 parallel issues against 100 units: exactly 10 succeeded, 10 cleanly rejected, balance landed on 0, never negative, no duplicate document numbers; 15 parallel receipts: no lost updates                                                                                                                                                                                               |
