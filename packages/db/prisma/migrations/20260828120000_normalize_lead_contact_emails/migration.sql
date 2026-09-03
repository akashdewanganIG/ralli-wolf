








UPDATE "leads"
SET "email" = lower("email")
WHERE "email" <> lower("email");






UPDATE "contacts" c
SET "email" = lower(c."email")
WHERE c."email" <> lower(c."email")
  AND NOT EXISTS (
    SELECT 1 FROM "contacts" other
    WHERE other."id" <> c."id"
      AND other."email" = lower(c."email")
  );
