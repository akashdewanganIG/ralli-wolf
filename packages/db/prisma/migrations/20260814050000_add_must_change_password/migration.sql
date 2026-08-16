-- Accounts created by an admin start with a generated password that has been
-- emailed in plaintext, so the holder must replace it before the account is
-- usable for anything else.
ALTER TABLE "users"
ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
