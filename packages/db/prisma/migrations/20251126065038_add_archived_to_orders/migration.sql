-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "archived_by" INTEGER;

-- CreateIndex
CREATE INDEX "orders_archived_idx" ON "orders"("archived");
