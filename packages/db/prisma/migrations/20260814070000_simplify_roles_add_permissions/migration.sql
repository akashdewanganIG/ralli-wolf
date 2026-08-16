-- Collapse the role system to ADMIN / SALES / CUSTOM.
--
-- SYSTEM_ADMIN was the top role, so its holders become ADMIN: ADMIN is now the
-- top role and implicitly holds every permission. Existing ADMIN accounts
-- therefore gain the capabilities that used to be SYSTEM_ADMIN-only (user
-- management above all) -- that is the intended consequence of removing the
-- tier, not an accident.
--
-- Postgres cannot drop a value from an enum in place, so the type is rebuilt.

-- 1. Per-user permission list, read only for the CUSTOM role.
ALTER TABLE "users"
ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 2. Rebuild the enum without SYSTEM_ADMIN and with CUSTOM.
ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SALES', 'CUSTOM');

-- Drop the default before the cast: it is typed against the old enum.
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "users"
ALTER COLUMN "role" TYPE "UserRole"
USING (
  CASE "role"::text
    WHEN 'SYSTEM_ADMIN' THEN 'ADMIN'
    ELSE "role"::text
  END
)::"UserRole";

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'SALES';

DROP TYPE "UserRole_old";
