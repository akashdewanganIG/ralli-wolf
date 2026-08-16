CREATE TABLE "login_otps" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "login_otps_user_id_created_at_idx" ON "login_otps"("user_id", "created_at");
CREATE INDEX "login_otps_expires_at_idx" ON "login_otps"("expires_at");

ALTER TABLE "login_otps"
ADD CONSTRAINT "login_otps_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
