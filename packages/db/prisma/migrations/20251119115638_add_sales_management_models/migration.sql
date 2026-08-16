/*
  Warnings:

  - The values [NO_GST,UPLOADED] on the enum `InvoiceCategory` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `order_id` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the `dealer_master` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `order_items` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[order_number]` on the table `orders` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `order_number` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AuditCategory" AS ENUM ('CAMPAIGN_MANAGEMENT', 'SALES_MANAGEMENT');

-- AlterEnum
BEGIN;
CREATE TYPE "InvoiceCategory_new" AS ENUM ('PENDING', 'DUPLICATE', 'NOT_CLEAR', 'OLD', 'DIFFERENT_CONTRACTOR', 'WITHOUT_GST', 'NON_PROGRAM', 'IRRELEVANT', 'NON_DEALER');
ALTER TABLE "invoices" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "invoices" ALTER COLUMN "category" TYPE "InvoiceCategory_new" USING ("category"::text::"InvoiceCategory_new");
ALTER TYPE "InvoiceCategory" RENAME TO "InvoiceCategory_old";
ALTER TYPE "InvoiceCategory_new" RENAME TO "InvoiceCategory";
DROP TYPE "InvoiceCategory_old";
ALTER TABLE "invoices" ALTER COLUMN "category" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PROCESSING';

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_order_id_fkey";

-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_order_id_fkey";

-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_id_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_subdealer_id_fkey";

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "category" "AuditCategory" DEFAULT 'CAMPAIGN_MANAGEMENT';

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "order_id",
ADD COLUMN     "status" TEXT DEFAULT 'pending',
ALTER COLUMN "category" DROP NOT NULL;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "order_number" TEXT NOT NULL,
ALTER COLUMN "total_amount" DROP DEFAULT;

-- AlterTable
ALTER TABLE "subdealers" ADD COLUMN     "jwt_token" TEXT,
ADD COLUMN     "token_issued_at" TIMESTAMP(3);

-- DropTable
DROP TABLE "dealer_master";

-- DropTable
DROP TABLE "order_items";

-- CreateTable
CREATE TABLE "product_line_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_line_items_order_id_idx" ON "product_line_items"("order_id");

-- CreateIndex
CREATE INDEX "product_line_items_product_id_idx" ON "product_line_items"("product_id");

-- CreateIndex
CREATE INDEX "audit_logs_category_idx" ON "audit_logs"("category");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_subdealer_id_fkey" FOREIGN KEY ("subdealer_id") REFERENCES "subdealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_line_items" ADD CONSTRAINT "product_line_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_line_items" ADD CONSTRAINT "product_line_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
