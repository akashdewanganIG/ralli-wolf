ALTER TABLE "orders" ADD COLUMN "subdealer_id" INTEGER;

CREATE INDEX "orders_subdealer_id_idx" ON "orders"("subdealer_id");

ALTER TABLE "orders"
ADD CONSTRAINT "orders_subdealer_id_fkey"
FOREIGN KEY ("subdealer_id") REFERENCES "subdealers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
