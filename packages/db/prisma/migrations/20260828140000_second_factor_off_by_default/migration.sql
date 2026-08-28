-- Sign-in is password-only unless someone deliberately adds a second factor.
--
-- `20260828090000_email_otp_default_and_backfill` defaulted `email_otp_verified_at`
-- so that no account could be left with no usable second step. That default was
-- a workaround for a login route that skipped sending a code while still asking
-- for one; the route now signs a password-only account straight in, so nothing
-- depends on the default any more and it can go.
ALTER TABLE "users"
  ALTER COLUMN "email_otp_verified_at" DROP DEFAULT;

-- Turn the emailed code off on the accounts that have it. Deliberate: the
-- second factor is now opt-in, chosen per account in Settings, rather than
-- something every account is enrolled in whether or not it can receive mail.
-- An account that enrolled an authenticator keeps it — only the emailed code
-- is being withdrawn here.
UPDATE "users"
SET "email_otp_verified_at" = NULL
WHERE "deleted_at" IS NULL
  AND "email_otp_verified_at" IS NOT NULL;
