-- Authentication methods per account.
--
-- An account must always keep at least two enabled *and verified* methods.
-- `*_verified_at` is what counts toward that rule: a method that has been set
-- up but never proved by entering a code does not.

ALTER TABLE "users"
  ADD COLUMN "password_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "totp_secret" TEXT,
  ADD COLUMN "totp_verified_at" TIMESTAMP(3),
  ADD COLUMN "email_otp_verified_at" TIMESTAMP(3);

-- Every existing account already signs in with a password plus an emailed
-- code, so both methods are backfilled as verified. Without this, the new
-- minimum would lock out every user on the first deploy.
UPDATE "users"
SET "email_otp_verified_at" = COALESCE("email_otp_verified_at", NOW())
WHERE "deleted_at" IS NULL;

-- Only ever one live TOTP secret per account; the partial index keeps lookups
-- cheap without indexing the many NULLs.
CREATE INDEX "users_totp_verified_at_idx" ON "users" ("totp_verified_at")
  WHERE "totp_verified_at" IS NOT NULL;
