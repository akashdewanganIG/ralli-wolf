/*
  Warnings:

  - The `source` column on the `leads` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `leads` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `campaign_deliveries` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `message_templates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `messaging_accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_permissions` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SYSTEM_ADMIN', 'ADMIN', 'SALES');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('OPEN', 'WORKING', 'QUALIFIED', 'UNQUALIFIED', 'NURTURING', 'CONVERTED');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('IMPORT', 'LANDING_PAGE', 'MANUAL');



-- AlterTable
ALTER TABLE "leads" DROP COLUMN "source",
ADD COLUMN     "source" "LeadSource",
DROP COLUMN "status",
ADD COLUMN     "status" "LeadStatus";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'SALES';

-- DropTable
DROP TABLE "user_permissions";
