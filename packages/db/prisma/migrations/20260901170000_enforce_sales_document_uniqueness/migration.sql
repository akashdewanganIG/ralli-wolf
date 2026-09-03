



DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "quotes"
    GROUP BY "opportunity_id", "version"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Cannot enforce quote version uniqueness: duplicate opportunity/version pairs exist',
      HINT = 'Query quotes grouped by opportunity_id and version, reconcile duplicates, then retry the migration.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "quotes"
    WHERE "is_primary" = TRUE
    GROUP BY "opportunity_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Cannot enforce one primary quote: an opportunity has multiple primary quotes',
      HINT = 'Choose one primary quote per opportunity, clear the others, then retry the migration.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "sales_orders"
    WHERE "quote_id" IS NOT NULL
    GROUP BY "quote_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Cannot enforce one sales order per quote: duplicate quote references exist',
      HINT = 'Reconcile sales orders sharing quote_id, then retry the migration.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "approval_processes"
    WHERE "status" = 'PENDING'
    GROUP BY "targetObjectName", "target_record_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Cannot enforce one pending approval: duplicate live approval requests exist',
      HINT = 'Resolve duplicate PENDING approvals for each target, then retry the migration.';
  END IF;
END
$$;



ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'PRESENTING' BEFORE 'PRESENTED';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'SENDING' BEFORE 'SENT';

CREATE UNIQUE INDEX "quotes_opportunity_id_version_key"
ON "quotes"("opportunity_id", "version");

CREATE UNIQUE INDEX "quotes_one_primary_per_opportunity"
ON "quotes"("opportunity_id")
WHERE "is_primary" = TRUE;



DROP INDEX IF EXISTS "sales_orders_quote_id_idx";
CREATE UNIQUE INDEX "sales_orders_quote_id_key"
ON "sales_orders"("quote_id");



CREATE UNIQUE INDEX "approval_processes_one_pending_per_target"
ON "approval_processes"("targetObjectName", "target_record_id")
WHERE "status" = 'PENDING';



ALTER TABLE "quotes" DROP COLUMN "pdf_url";



UPDATE "leads" SET "source" = 'MANUAL' WHERE "source" IS NULL;
UPDATE "leads" SET "status" = 'OPEN' WHERE "status" IS NULL;
ALTER TABLE "leads"
  ALTER COLUMN "source" SET DEFAULT 'MANUAL',
  ALTER COLUMN "source" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'OPEN',
  ALTER COLUMN "status" SET NOT NULL,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;




ALTER TABLE "notifications" ADD COLUMN "dedupe_key" TEXT;
CREATE UNIQUE INDEX "notifications_dedupe_key_key"
  ON "notifications"("dedupe_key");
