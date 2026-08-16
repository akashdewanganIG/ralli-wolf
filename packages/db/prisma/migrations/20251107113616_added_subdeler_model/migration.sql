-- CreateTable
CREATE TABLE "subdealers" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "gst_number" TEXT NOT NULL,
    "email" TEXT,
    "legal_name" TEXT NOT NULL,
    "trade_name" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "pan_number" TEXT,
    "registration_date" TIMESTAMP(3),
    "business_type" TEXT,
    "status" TEXT,
    "jurisdiction" TEXT,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subdealers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subdealer_otps" (
    "id" SERIAL NOT NULL,
    "subdealer_id" INTEGER,
    "phone" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subdealer_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subdealers_phone_key" ON "subdealers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "subdealers_gst_number_key" ON "subdealers"("gst_number");

-- CreateIndex
CREATE INDEX "subdealer_otps_phone_idx" ON "subdealer_otps"("phone");

-- CreateIndex
CREATE INDEX "subdealer_otps_subdealer_id_idx" ON "subdealer_otps"("subdealer_id");

-- AddForeignKey
ALTER TABLE "subdealer_otps" ADD CONSTRAINT "subdealer_otps_subdealer_id_fkey" FOREIGN KEY ("subdealer_id") REFERENCES "subdealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
