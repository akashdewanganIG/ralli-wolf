-- Store lead and contact email addresses in canonical (lower-case) form.
--
-- Dedup on the import, webhook and Brevo paths matches on plain equality, so a
-- lead submitted as `John@X.com` never matched the stored `john@x.com` and the
-- same person was inserted twice. The application now normalises on every
-- write; this brings existing rows into line so the equality holds for data
-- written before that.

-- `leads.email` is indexed but not unique, so lowercasing cannot collide.
UPDATE "leads"
SET "email" = lower("email")
WHERE "email" <> lower("email");

-- `contacts.email` IS unique. Lowercase only the rows where doing so cannot
-- collide with an existing contact; a genuine collision means two contact
-- records for one person, and merging them means reassigning their relations,
-- which is a decision for a human rather than a migration. Those rows keep
-- their current casing and stay findable.
UPDATE "contacts" c
SET "email" = lower(c."email")
WHERE c."email" <> lower(c."email")
  AND NOT EXISTS (
    SELECT 1 FROM "contacts" other
    WHERE other."id" <> c."id"
      AND other."email" = lower(c."email")
  );
