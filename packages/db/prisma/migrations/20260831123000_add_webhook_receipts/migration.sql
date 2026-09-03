CREATE TABLE "webhook_receipts" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "body_digest" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_receipts_provider_body_digest_key"
    ON "webhook_receipts"("provider", "body_digest");

CREATE INDEX "webhook_receipts_expires_at_idx"
    ON "webhook_receipts"("expires_at");
