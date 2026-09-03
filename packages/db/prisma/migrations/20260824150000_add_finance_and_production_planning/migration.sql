











CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'WRITTEN_OFF');


CREATE TYPE "PaymentDirection" AS ENUM ('OUTGOING', 'INCOMING');


CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CHEQUE', 'CASH', 'UPI', 'CARD', 'CREDIT_NOTE');


CREATE TYPE "WorkCenterType" AS ENUM ('MACHINE', 'ASSEMBLY_LINE', 'WORKSTATION', 'INSPECTION', 'PACKING');


CREATE TYPE "OperationStatus" AS ENUM ('PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');


CREATE TABLE "supplier_invoices" (
    "id" SERIAL NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "supplier_ref" TEXT,
    "supplier_id" INTEGER NOT NULL,
    "purchase_order_id" INTEGER,
    "grn_id" INTEGER,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'INR',
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "approved_by_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "customer_invoices" (
    "id" SERIAL NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "account_id" INTEGER NOT NULL,
    "sales_order_id" INTEGER,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'INR',
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_invoices_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "payment_number" TEXT NOT NULL,
    "direction" "PaymentDirection" NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'INR',
    "amount" DECIMAL(18,2) NOT NULL,
    "unallocated" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "supplier_id" INTEGER,
    "account_id" INTEGER,
    "notes" TEXT,
    "recorded_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "payment_allocations" (
    "id" SERIAL NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "supplier_invoice_id" INTEGER,
    "customer_invoice_id" INTEGER,
    "amount" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "work_centers" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "type" "WorkCenterType" NOT NULL DEFAULT 'MACHINE',
    "description" TEXT,
    "capacity_minutes_per_day" INTEGER NOT NULL DEFAULT 480,
    "efficiency_percent" DECIMAL(5,2) NOT NULL DEFAULT 85,
    "cost_per_hour" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "parallel_capacity" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_centers_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "bom_operations" (
    "id" SERIAL NOT NULL,
    "bom_id" INTEGER NOT NULL,
    "work_center_id" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "setup_minutes" INTEGER NOT NULL DEFAULT 0,
    "run_minutes_per_unit" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "is_blocking" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bom_operations_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "production_order_operations" (
    "id" SERIAL NOT NULL,
    "production_order_id" INTEGER NOT NULL,
    "work_center_id" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "OperationStatus" NOT NULL DEFAULT 'PENDING',
    "planned_minutes" INTEGER NOT NULL DEFAULT 0,
    "actual_minutes" INTEGER,
    "scheduled_start" TIMESTAMP(3),
    "scheduled_end" TIMESTAMP(3),
    "actual_start" TIMESTAMP(3),
    "actual_end" TIMESTAMP(3),
    "completed_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_order_operations_pkey" PRIMARY KEY ("id")
);


CREATE UNIQUE INDEX "supplier_invoices_invoice_number_key" ON "supplier_invoices"("invoice_number");


CREATE INDEX "supplier_invoices_supplier_id_idx" ON "supplier_invoices"("supplier_id");


CREATE INDEX "supplier_invoices_status_due_date_idx" ON "supplier_invoices"("status", "due_date");


CREATE UNIQUE INDEX "customer_invoices_invoice_number_key" ON "customer_invoices"("invoice_number");


CREATE INDEX "customer_invoices_account_id_idx" ON "customer_invoices"("account_id");


CREATE INDEX "customer_invoices_status_due_date_idx" ON "customer_invoices"("status", "due_date");


CREATE UNIQUE INDEX "payments_payment_number_key" ON "payments"("payment_number");


CREATE INDEX "payments_direction_payment_date_idx" ON "payments"("direction", "payment_date");


CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations"("payment_id");


CREATE INDEX "payment_allocations_supplier_invoice_id_idx" ON "payment_allocations"("supplier_invoice_id");


CREATE INDEX "payment_allocations_customer_invoice_id_idx" ON "payment_allocations"("customer_invoice_id");


CREATE UNIQUE INDEX "work_centers_code_key" ON "work_centers"("code");


CREATE INDEX "work_centers_warehouse_id_idx" ON "work_centers"("warehouse_id");


CREATE INDEX "bom_operations_work_center_id_idx" ON "bom_operations"("work_center_id");


CREATE UNIQUE INDEX "bom_operations_bom_id_sequence_key" ON "bom_operations"("bom_id", "sequence");


CREATE INDEX "production_order_operations_work_center_id_scheduled_start_idx" ON "production_order_operations"("work_center_id", "scheduled_start");


CREATE UNIQUE INDEX "production_order_operations_production_order_id_sequence_key" ON "production_order_operations"("production_order_id", "sequence");


ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "goods_receipt_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "payments" ADD CONSTRAINT "payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "payments" ADD CONSTRAINT "payments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_customer_invoice_id_fkey" FOREIGN KEY ("customer_invoice_id") REFERENCES "customer_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "work_centers" ADD CONSTRAINT "work_centers_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "bom_operations" ADD CONSTRAINT "bom_operations_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "bills_of_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "bom_operations" ADD CONSTRAINT "bom_operations_work_center_id_fkey" FOREIGN KEY ("work_center_id") REFERENCES "work_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "production_order_operations" ADD CONSTRAINT "production_order_operations_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "production_order_operations" ADD CONSTRAINT "production_order_operations_work_center_id_fkey" FOREIGN KEY ("work_center_id") REFERENCES "work_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
