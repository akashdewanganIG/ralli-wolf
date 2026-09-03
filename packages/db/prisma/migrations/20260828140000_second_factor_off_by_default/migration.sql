






ALTER TABLE "users"
  ALTER COLUMN "email_otp_verified_at" DROP DEFAULT;






UPDATE "users"
SET "email_otp_verified_at" = NULL
WHERE "deleted_at" IS NULL
  AND "email_otp_verified_at" IS NOT NULL;
