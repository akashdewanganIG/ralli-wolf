/*
  Warnings:

  - You are about to drop the column `role_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `field_permissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `permissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `record_shares` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `role_permissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `roles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_permission_sets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_permissions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "field_permissions" DROP CONSTRAINT "field_permissions_role_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "record_shares" DROP CONSTRAINT "record_shares_shared_with_user_id_fkey";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_role_id_fkey";

-- DropForeignKey
ALTER TABLE "user_permission_sets" DROP CONSTRAINT "user_permission_sets_permission_set_id_fkey";

-- DropForeignKey
ALTER TABLE "user_permission_sets" DROP CONSTRAINT "user_permission_sets_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_permissions" DROP CONSTRAINT "user_permissions_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "user_permissions" DROP CONSTRAINT "user_permissions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_role_id_fkey";

-- AlterTable
ALTER TABLE "leads" ALTER COLUMN "owner_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "permission_sets" ADD COLUMN     "campaignManagement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "chatbotAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailMarketing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leadManagement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "systemAdminAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappCampaign" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role_id",
ADD COLUMN     "permission_set_id" INTEGER;

-- DropTable
DROP TABLE "field_permissions";

-- DropTable
DROP TABLE "permissions";

-- DropTable
DROP TABLE "record_shares";

-- DropTable
DROP TABLE "role_permissions";

-- DropTable
DROP TABLE "roles";

-- DropTable
DROP TABLE "user_permission_sets";

-- DropTable
DROP TABLE "user_permissions";

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_permission_set_id_fkey" FOREIGN KEY ("permission_set_id") REFERENCES "permission_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
