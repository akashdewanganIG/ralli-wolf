









ALTER TABLE "orders" DROP CONSTRAINT "orders_subdealer_id_fkey";


DROP INDEX "orders_status_idx";


DROP INDEX "orders_subdealer_id_idx";


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


ALTER TABLE "products" ALTER COLUMN "price" DROP NOT NULL;


ALTER TABLE "users" DROP COLUMN "name",
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "last_name" TEXT;


DROP TYPE "OrderStatus";


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


CREATE INDEX "sales_user_otps_phone_idx" ON "sales_user_otps"("phone");


CREATE INDEX "sales_user_otps_user_id_idx" ON "sales_user_otps"("user_id");


CREATE INDEX "orders_sales_user_id_idx" ON "orders"("sales_user_id");


CREATE UNIQUE INDEX "whatsapp_templates_whatsapp_number_id_name_key" ON "whatsapp_templates"("whatsapp_number_id", "name");


ALTER TABLE "orders" ADD CONSTRAINT "orders_sales_user_id_fkey" FOREIGN KEY ("sales_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
