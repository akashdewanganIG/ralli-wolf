











CREATE TYPE "UserRole" AS ENUM ('SYSTEM_ADMIN', 'ADMIN', 'SALES');


CREATE TYPE "LeadStatus" AS ENUM ('OPEN', 'WORKING', 'QUALIFIED', 'UNQUALIFIED', 'NURTURING', 'CONVERTED');


CREATE TYPE "LeadSource" AS ENUM ('IMPORT', 'LANDING_PAGE', 'MANUAL');




ALTER TABLE "leads" DROP COLUMN "source",
ADD COLUMN     "source" "LeadSource",
DROP COLUMN "status",
ADD COLUMN     "status" "LeadStatus";


ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'SALES';


DROP TABLE "user_permissions";
