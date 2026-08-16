/*
  Warnings:

  - You are about to drop the column `permission_set_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `permission_sets` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_permission_set_id_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "permission_set_id";

-- DropTable
DROP TABLE "permission_sets";

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "leadManagement" BOOLEAN NOT NULL DEFAULT false,
    "campaignManagement" BOOLEAN NOT NULL DEFAULT false,
    "chatbotAccess" BOOLEAN NOT NULL DEFAULT false,
    "whatsappCampaign" BOOLEAN NOT NULL DEFAULT false,
    "emailMarketing" BOOLEAN NOT NULL DEFAULT false,
    "systemAdminAccess" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_user_id_key" ON "user_permissions"("user_id");

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
