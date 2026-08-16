/*
  Warnings:

  - You are about to drop the column `campaign_id` on the `form_submissions` table. All the data in the column will be lost.
  - You are about to drop the column `company_location` on the `leads` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "form_submissions" DROP CONSTRAINT "form_submissions_campaign_id_fkey";

-- AlterTable
ALTER TABLE "form_submissions" DROP COLUMN "campaign_id";

-- AlterTable
ALTER TABLE "leads" DROP COLUMN "company_location";
