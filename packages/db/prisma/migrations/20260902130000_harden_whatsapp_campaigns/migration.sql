


ALTER TABLE "whatsapp_campaign_configs"
  ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'all';

UPDATE "whatsapp_campaign_configs" AS config
SET "audience" = 'segment'
WHERE config."segment_id" IS NOT NULL;

UPDATE "whatsapp_campaign_configs" AS config
SET "audience" = 'upload'
WHERE config."segment_id" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "campaign_deliveries" AS delivery
    WHERE delivery."campaign_id" = config."campaign_id"
      AND delivery."csv_data" IS NOT NULL
  );

UPDATE "whatsapp_numbers"
SET "status" = 'ACTIVE'
WHERE "status" IS NULL;

UPDATE "whatsapp_numbers"
SET "provider" = 'MSG91'
WHERE lower("provider") = 'msg91';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "whatsapp_numbers"
    WHERE "status" NOT IN ('ACTIVE', 'INACTIVE')
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Cannot enforce WhatsApp account status values: unsupported legacy status exists.',
      HINT = 'Map every WhatsApp account status to ACTIVE or INACTIVE, then rerun the migration.';
  END IF;
END $$;

ALTER TABLE "whatsapp_numbers"
  ALTER COLUMN "status" SET NOT NULL,
  ADD CONSTRAINT "whatsapp_numbers_status_check"
    CHECK ("status" IN ('ACTIVE', 'INACTIVE')),
  ADD CONSTRAINT "whatsapp_numbers_display_name_check"
    CHECK (char_length(btrim("display_name")) BETWEEN 1 AND 120),
  ADD CONSTRAINT "whatsapp_numbers_phone_check"
    CHECK ("phone_number" ~ '^[1-9][0-9]{7,14}$');

UPDATE "whatsapp_campaign_configs" AS config
SET "audience" = 'leads'
WHERE config."segment_id" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "campaign_deliveries" AS delivery
    WHERE delivery."campaign_id" = config."campaign_id"
      AND delivery."lead_id" IS NOT NULL
  );

DO $$
DECLARE
  duplicate_delivery RECORD;
BEGIN
  SELECT "campaign_id", "channel", "address", COUNT(*) AS row_count
  INTO duplicate_delivery
  FROM "campaign_deliveries"
  GROUP BY "campaign_id", "channel", "address"
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION USING
      MESSAGE = format(
        'Cannot enforce campaign delivery uniqueness: campaign %s has %s %s deliveries for %s.',
        duplicate_delivery."campaign_id",
        duplicate_delivery.row_count,
        duplicate_delivery."channel",
        duplicate_delivery."address"
      ),
      HINT = 'Resolve duplicate recipients for each campaign and channel, then rerun the migration.';
  END IF;
END $$;

ALTER TABLE "whatsapp_campaign_configs"
  ADD CONSTRAINT "whatsapp_campaign_configs_audience_check"
    CHECK ("audience" IN ('all', 'segment', 'upload', 'leads')),
  ADD CONSTRAINT "whatsapp_campaign_configs_segment_audience_check"
    CHECK (
      ("audience" = 'segment' AND "segment_id" IS NOT NULL)
      OR ("audience" <> 'segment' AND "segment_id" IS NULL)
    ),
  ADD CONSTRAINT "whatsapp_campaign_configs_batch_size_check"
    CHECK ("batch_size" BETWEEN 1 AND 800);

ALTER TABLE "campaign_deliveries"
  ADD COLUMN "processing_started_at" TIMESTAMP(3),
  ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_attempt_at" TIMESTAMP(3),
  ADD CONSTRAINT "campaign_deliveries_single_entity_check"
    CHECK (num_nonnulls("contact_id", "lead_id") <= 1),
  ADD CONSTRAINT "campaign_deliveries_attempt_count_check"
    CHECK ("attempt_count" BETWEEN 0 AND 3),
  ADD CONSTRAINT "campaign_deliveries_processing_timestamp_check"
    CHECK (
      ("status" = 'PROCESSING' AND "processing_started_at" IS NOT NULL)
      OR ("status" <> 'PROCESSING' AND "processing_started_at" IS NULL)
    );

CREATE UNIQUE INDEX "campaign_deliveries_campaign_id_channel_address_key"
  ON "campaign_deliveries"("campaign_id", "channel", "address");

CREATE INDEX "campaign_deliveries_campaign_id_status_idx"
  ON "campaign_deliveries"("campaign_id", "status");

CREATE INDEX "campaign_deliveries_status_processing_started_at_idx"
  ON "campaign_deliveries"("status", "processing_started_at");
