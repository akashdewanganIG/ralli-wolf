



ALTER TABLE "leads" ADD COLUMN "brevo_contact_id" TEXT;


COMMENT ON COLUMN "leads"."brevo_contact_id" IS 'Brevo contact ID for leads synced to Brevo email marketing platform';
