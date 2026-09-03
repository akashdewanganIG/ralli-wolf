





ALTER TABLE "users"
  ADD COLUMN "password_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "totp_secret" TEXT,
  ADD COLUMN "totp_verified_at" TIMESTAMP(3),
  ADD COLUMN "email_otp_verified_at" TIMESTAMP(3);




UPDATE "users"
SET "email_otp_verified_at" = COALESCE("email_otp_verified_at", NOW())
WHERE "deleted_at" IS NULL;



CREATE INDEX "users_totp_verified_at_idx" ON "users" ("totp_verified_at")
  WHERE "totp_verified_at" IS NOT NULL;
