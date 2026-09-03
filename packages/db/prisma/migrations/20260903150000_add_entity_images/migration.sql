-- Adds image support for products, suppliers, goods receipts and quality checks.
--
-- Purely additive: one nullable column, three tables, four indexes, four
-- foreign keys, plus a backfill. No drops and no type changes.
--
-- APPLY WITH `prisma migrate deploy`, NOT `prisma migrate dev`.
-- The live database has pre-existing drift from schema.prisma unrelated to this
-- change (roughly 54 foreign keys whose definitions differ, four `updated_at`
-- DROP DEFAULTs, and two missing campaign_members indexes). `migrate dev` would
-- try to reconcile all of that; `migrate deploy` applies only the statements
-- below.

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "logo_url" TEXT;

-- CreateTable
CREATE TABLE "product_images" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_images" (
    "id" SERIAL NOT NULL,
    "grn_id" INTEGER NOT NULL,
    "grn_line_id" INTEGER,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipt_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_check_images" (
    "id" SERIAL NOT NULL,
    "quality_check_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_check_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_images_product_id_sort_order_idx" ON "product_images"("product_id", "sort_order");

-- CreateIndex
CREATE INDEX "goods_receipt_images_grn_id_sort_order_idx" ON "goods_receipt_images"("grn_id", "sort_order");

-- CreateIndex
CREATE INDEX "goods_receipt_images_grn_line_id_idx" ON "goods_receipt_images"("grn_line_id");

-- CreateIndex
CREATE INDEX "quality_check_images_quality_check_id_sort_order_idx" ON "quality_check_images"("quality_check_id", "sort_order");

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_images" ADD CONSTRAINT "goods_receipt_images_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "goods_receipt_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_images" ADD CONSTRAINT "goods_receipt_images_grn_line_id_fkey" FOREIGN KEY ("grn_line_id") REFERENCES "goods_receipt_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_check_images" ADD CONSTRAINT "quality_check_images_quality_check_id_fkey" FOREIGN KEY ("quality_check_id") REFERENCES "quality_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: carry each product's existing single image into the new gallery
-- table as the first image. products.image_url is retained and kept in sync
-- with sort_order 0 so existing readers keep working.
INSERT INTO "product_images" ("product_id", "url", "sort_order", "created_at")
SELECT "id", "image_url", 0, CURRENT_TIMESTAMP
FROM "products"
WHERE "image_url" IS NOT NULL AND "image_url" <> '';
