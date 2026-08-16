-- CreateEnum
CREATE TYPE "LandingPageCampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'SCHEDULED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('UNRESOLVED', 'RESOLVED', 'IN_PROGRESS');

-- DropIndex
DROP INDEX "leads_email_key";

-- CreateTable
CREATE TABLE "landing_page_campaigns" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unique_id" TEXT NOT NULL,
    "status" "LandingPageCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,

    CONSTRAINT "landing_page_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiries" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "landing_page_campaign_id" INTEGER,
    "custom_fields" JSONB,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'UNRESOLVED',
    "enquiry_created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" INTEGER,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "landing_page_campaigns_unique_id_key" ON "landing_page_campaigns"("unique_id");

-- CreateIndex
CREATE INDEX "landing_page_campaigns_status_idx" ON "landing_page_campaigns"("status");

-- CreateIndex
CREATE INDEX "landing_page_campaigns_created_at_idx" ON "landing_page_campaigns"("created_at");

-- CreateIndex
CREATE INDEX "enquiries_lead_id_idx" ON "enquiries"("lead_id");

-- CreateIndex
CREATE INDEX "enquiries_landing_page_campaign_id_idx" ON "enquiries"("landing_page_campaign_id");

-- CreateIndex
CREATE INDEX "enquiries_status_idx" ON "enquiries"("status");

-- CreateIndex
CREATE INDEX "enquiries_enquiry_created_at_idx" ON "enquiries"("enquiry_created_at");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_phone_idx" ON "leads"("phone");

-- CreateIndex
CREATE INDEX "leads_deleted_at_idx" ON "leads"("deleted_at");

-- AddForeignKey
ALTER TABLE "landing_page_campaigns" ADD CONSTRAINT "landing_page_campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_landing_page_campaign_id_fkey" FOREIGN KEY ("landing_page_campaign_id") REFERENCES "landing_page_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
