










ALTER TABLE "users"
  ALTER COLUMN "email_otp_verified_at" SET DEFAULT CURRENT_TIMESTAMP;




UPDATE "users"
SET "email_otp_verified_at" = NOW()
WHERE "deleted_at" IS NULL
  AND "email_otp_verified_at" IS NULL
  AND "totp_verified_at" IS NULL;
