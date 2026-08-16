/*
  Warnings:

  - You are about to drop the column `status` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `subdealer_id` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[whatsapp_number_id,name]` on the table `whatsapp_templates` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_subdealer_id_fkey";

-- DropIndex
DROP INDEX "orders_status_idx";

-- DropIndex
DROP INDEX "orders_subdealer_id_idx";

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "status",
DROP COLUMN "subdealer_id",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "contact_number" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "firm_name" TEXT,
ADD COLUMN     "owner_first_name" TEXT,
ADD COLUMN     "owner_last_name" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "sales_user_id" INTEGER,
ADD COLUMN     "state" TEXT,
ALTER COLUMN "total_amount" DROP NOT NULL;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "price" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "name",
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "last_name" TEXT;

-- DropEnum
DROP TYPE "OrderStatus";

-- CreateTable
CREATE TABLE "sales_user_otps" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "phone" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_user_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_user_otps_phone_idx" ON "sales_user_otps"("phone");

-- CreateIndex
CREATE INDEX "sales_user_otps_user_id_idx" ON "sales_user_otps"("user_id");

-- CreateIndex
CREATE INDEX "orders_sales_user_id_idx" ON "orders"("sales_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_templates_whatsapp_number_id_name_key" ON "whatsapp_templates"("whatsapp_number_id", "name");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_sales_user_id_fkey" FOREIGN KEY ("sales_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
