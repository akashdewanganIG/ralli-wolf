-- Migration: Add brevo_contact_id field to leads table
-- This migration adds the brevoContactId field to store Brevo contact IDs

-- Add the brevo_contact_id column to the leads table
ALTER TABLE "leads" ADD COLUMN "brevo_contact_id" TEXT;

-- Add a comment to document the field
COMMENT ON COLUMN "leads"."brevo_contact_id" IS 'Brevo contact ID for leads synced to Brevo email marketing platform';
