










ALTER TABLE "users"
ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];


ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SALES', 'CUSTOM');


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
