-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "email_opt_out" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "opt_out_date" TIMESTAMP(3),
ADD COLUMN     "sms_opt_out" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsapp_opt_out" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "email_opt_out" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "opt_out_date" TIMESTAMP(3),
ADD COLUMN     "sms_opt_out" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsapp_opt_out" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "opt_outs" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "opted_out_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "campaign_id" INTEGER,
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opt_outs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "opt_outs_phone_idx" ON "opt_outs"("phone");

-- CreateIndex
CREATE INDEX "opt_outs_channel_idx" ON "opt_outs"("channel");

-- CreateIndex
CREATE INDEX "opt_outs_opted_out_at_idx" ON "opt_outs"("opted_out_at");

-- CreateIndex
CREATE UNIQUE INDEX "opt_outs_phone_channel_key" ON "opt_outs"("phone", "channel");

-- AddForeignKey
ALTER TABLE "opt_outs" ADD CONSTRAINT "opt_outs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
