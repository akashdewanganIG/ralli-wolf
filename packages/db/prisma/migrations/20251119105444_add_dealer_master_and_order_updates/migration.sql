-- CreateEnum
CREATE TYPE "InvoiceCategory" AS ENUM ('PENDING', 'DUPLICATE', 'NOT_CLEAR', 'OLD', 'DIFFERENT_CONTRACTOR', 'NO_GST', 'NON_PROGRAM', 'IRRELEVANT', 'NON_DEALER', 'UPLOADED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "category" "InvoiceCategory" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "order_id" INTEGER;

-- CreateTable
CREATE TABLE "dealer_master" (
    "id" SERIAL NOT NULL,
    "sub_dealer_name" TEXT NOT NULL,
    "owner_name" TEXT,
    "pincode" TEXT,
    "state" TEXT,
    "city" TEXT,
    "mobile_number" TEXT NOT NULL,
    "gst_number" TEXT,
    "region" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealer_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "subdealer_id" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "total_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dealer_master_mobile_number_key" ON "dealer_master"("mobile_number");

-- CreateIndex
CREATE INDEX "orders_subdealer_id_idx" ON "orders"("subdealer_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "invoices_category_idx" ON "invoices"("category");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_subdealer_id_fkey" FOREIGN KEY ("subdealer_id") REFERENCES "subdealers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
