







ALTER TABLE "form_submissions" DROP CONSTRAINT "form_submissions_campaign_id_fkey";


ALTER TABLE "form_submissions" DROP COLUMN "campaign_id";


ALTER TABLE "leads" DROP COLUMN "company_location";
