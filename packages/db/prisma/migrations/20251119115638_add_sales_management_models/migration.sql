











CREATE TYPE "AuditCategory" AS ENUM ('CAMPAIGN_MANAGEMENT', 'SALES_MANAGEMENT');


BEGIN;
CREATE TYPE "InvoiceCategory_new" AS ENUM ('PENDING', 'DUPLICATE', 'NOT_CLEAR', 'OLD', 'DIFFERENT_CONTRACTOR', 'WITHOUT_GST', 'NON_PROGRAM', 'IRRELEVANT', 'NON_DEALER');
ALTER TABLE "invoices" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "invoices" ALTER COLUMN "category" TYPE "InvoiceCategory_new" USING ("category"::text::"InvoiceCategory_new");
ALTER TYPE "InvoiceCategory" RENAME TO "InvoiceCategory_old";
ALTER TYPE "InvoiceCategory_new" RENAME TO "InvoiceCategory";
DROP TYPE "InvoiceCategory_old";
ALTER TABLE "invoices" ALTER COLUMN "category" SET DEFAULT 'PENDING';
COMMIT;


ALTER TYPE "OrderStatus" ADD VALUE 'PROCESSING';


ALTER TABLE "invoices" DROP CONSTRAINT "invoices_order_id_fkey";


ALTER TABLE "order_items" DROP CONSTRAINT "order_items_order_id_fkey";


ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_id_fkey";


ALTER TABLE "orders" DROP CONSTRAINT "orders_subdealer_id_fkey";


ALTER TABLE "audit_logs" ADD COLUMN     "category" "AuditCategory" DEFAULT 'CAMPAIGN_MANAGEMENT';


ALTER TABLE "invoices" DROP COLUMN "order_id",
ADD COLUMN     "status" TEXT DEFAULT 'pending',
ALTER COLUMN "category" DROP NOT NULL;


ALTER TABLE "orders" ADD COLUMN     "order_number" TEXT NOT NULL,
ALTER COLUMN "total_amount" DROP DEFAULT;


ALTER TABLE "subdealers" ADD COLUMN     "jwt_token" TEXT,
ADD COLUMN     "token_issued_at" TIMESTAMP(3);


DROP TABLE "dealer_master";


DROP TABLE "order_items";


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


CREATE INDEX "product_line_items_order_id_idx" ON "product_line_items"("order_id");


CREATE INDEX "product_line_items_product_id_idx" ON "product_line_items"("product_id");


CREATE INDEX "audit_logs_category_idx" ON "audit_logs"("category");


CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");


ALTER TABLE "orders" ADD CONSTRAINT "orders_subdealer_id_fkey" FOREIGN KEY ("subdealer_id") REFERENCES "subdealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "product_line_items" ADD CONSTRAINT "product_line_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "product_line_items" ADD CONSTRAINT "product_line_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
