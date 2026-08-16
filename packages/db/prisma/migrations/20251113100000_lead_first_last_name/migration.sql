ALTER TABLE "leads"
    ADD COLUMN "first_name" TEXT,
    ADD COLUMN "last_name" TEXT;

UPDATE "leads"
SET
    "first_name" = COALESCE(NULLIF(split_part(name, ' ', 1), ''), 'Unknown'),
    "last_name" = NULLIF(
        CASE
            WHEN position(' ' in name) = 0 THEN NULL
            ELSE btrim(substring(name FROM position(' ' in name) + 1))
        END,
        ''
    )
WHERE "first_name" IS NULL;

ALTER TABLE "leads"
    ALTER COLUMN "first_name" SET NOT NULL;

ALTER TABLE "leads"
    DROP COLUMN "name";

