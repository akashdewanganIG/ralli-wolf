CREATE TABLE "warehouse_images" (
    "id" SERIAL NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "warehouse_images_warehouse_id_sort_order_idx"
ON "warehouse_images"("warehouse_id", "sort_order");

ALTER TABLE "warehouse_images"
ADD CONSTRAINT "warehouse_images_warehouse_id_fkey"
FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
