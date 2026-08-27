-- Every account's starting second factor is an emailed code.
--
-- `20260820180000_add_auth_methods` backfilled the accounts that existed when
-- it ran, but nothing set the column on insert afterwards. Accounts created
-- since carry NULL, which `secondFactorFor` reads as "no second factor": the
-- login route then skips sending a code while still telling the client to ask
-- for one, and the account cannot sign in at all.
--
-- The default closes it at the table, so a create path that forgets the column
-- cannot reintroduce the same lockout. Disabling the method is an UPDATE to
-- NULL and is unaffected.
ALTER TABLE "users"
  ALTER COLUMN "email_otp_verified_at" SET DEFAULT CURRENT_TIMESTAMP;

-- Repair the accounts already stranded by the gap. Restricted to accounts that
-- have no other verified factor, so anyone who deliberately turned the emailed
-- code off in favour of an authenticator keeps that choice.
UPDATE "users"
SET "email_otp_verified_at" = NOW()
WHERE "deleted_at" IS NULL
  AND "email_otp_verified_at" IS NULL
  AND "totp_verified_at" IS NULL;
