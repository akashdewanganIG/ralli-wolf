













ALTER TABLE "field_permissions" DROP CONSTRAINT "field_permissions_role_id_fkey";


ALTER TABLE "leads" DROP CONSTRAINT "leads_owner_id_fkey";


ALTER TABLE "record_shares" DROP CONSTRAINT "record_shares_shared_with_user_id_fkey";


ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_permission_id_fkey";


ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_role_id_fkey";


ALTER TABLE "user_permission_sets" DROP CONSTRAINT "user_permission_sets_permission_set_id_fkey";


ALTER TABLE "user_permission_sets" DROP CONSTRAINT "user_permission_sets_user_id_fkey";


ALTER TABLE "user_permissions" DROP CONSTRAINT "user_permissions_permission_id_fkey";


ALTER TABLE "user_permissions" DROP CONSTRAINT "user_permissions_user_id_fkey";


ALTER TABLE "users" DROP CONSTRAINT "users_role_id_fkey";


ALTER TABLE "leads" ALTER COLUMN "owner_id" DROP NOT NULL;


ALTER TABLE "permission_sets" ADD COLUMN     "campaignManagement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "chatbotAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailMarketing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leadManagement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "systemAdminAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappCampaign" BOOLEAN NOT NULL DEFAULT false;


ALTER TABLE "users" DROP COLUMN "role_id",
ADD COLUMN     "permission_set_id" INTEGER;


DROP TABLE "field_permissions";


DROP TABLE "permissions";


DROP TABLE "record_shares";


DROP TABLE "role_permissions";


DROP TABLE "roles";


DROP TABLE "user_permission_sets";


DROP TABLE "user_permissions";


ALTER TABLE "users" ADD CONSTRAINT "users_permission_set_id_fkey" FOREIGN KEY ("permission_set_id") REFERENCES "permission_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
