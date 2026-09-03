WITH duplicate_legacy_channels AS (
  SELECT "channel_type", "external_id"
  FROM "campaign_channel"
  WHERE "channel_type" IN ('EMAIL', 'WHATSAPP')
  GROUP BY "channel_type", "external_id"
  HAVING COUNT(*) > 1
)
UPDATE "campaign_channel" AS channel
SET "external_id" = concat(
  'legacy-campaign-channel:',
  channel."id",
  ':',
  md5(channel."external_id")
)
FROM duplicate_legacy_channels AS duplicate
WHERE channel."channel_type" = duplicate."channel_type"
  AND channel."external_id" = duplicate."external_id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "campaign_channel"
    GROUP BY "channel_type", "external_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce campaign channel identity: duplicate channel_type/external_id mappings exist';
  END IF;
END $$;

CREATE UNIQUE INDEX "campaign_channel_channel_type_external_id_key"
ON "campaign_channel"("channel_type", "external_id");

DROP INDEX IF EXISTS "campaign_channel_campaign_id_channel_type_external_id_key";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "campaign_members"
    WHERE num_nonnulls("contact_id", "lead_id") <> 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce campaign member targets: every member must reference exactly one contact or lead';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "campaign_members"
    WHERE "lead_id" IS NOT NULL
    GROUP BY "campaign_id", "lead_id"
    HAVING COUNT(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM "campaign_members"
    WHERE "contact_id" IS NOT NULL
    GROUP BY "campaign_id", "contact_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce campaign member uniqueness: duplicate campaign recipients exist';
  END IF;
END $$;

DROP INDEX IF EXISTS "campaign_members_campaign_id_contact_id_lead_id_key";

ALTER TABLE "campaign_members"
  ADD CONSTRAINT "campaign_members_single_target_check"
    CHECK (num_nonnulls("contact_id", "lead_id") = 1),
  DROP CONSTRAINT "campaign_members_contact_id_fkey",
  DROP CONSTRAINT "campaign_members_lead_id_fkey";

ALTER TABLE "campaign_members"
  ADD CONSTRAINT "campaign_members_contact_id_fkey"
    FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "campaign_members_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "campaign_members_campaign_id_contact_id_key"
  ON "campaign_members"("campaign_id", "contact_id")
  WHERE "contact_id" IS NOT NULL;

CREATE UNIQUE INDEX "campaign_members_campaign_id_lead_id_key"
  ON "campaign_members"("campaign_id", "lead_id")
  WHERE "lead_id" IS NOT NULL;
