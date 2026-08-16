-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('FINISHED_GOOD', 'ACCESSORY', 'SPARE_PART', 'RAW_MATERIAL', 'COMPONENT', 'CONSUMABLE', 'PACKAGING', 'SERVICE');

-- CreateEnum
CREATE TYPE "TrackingType" AS ENUM ('NONE', 'BATCH', 'SERIAL');

-- CreateEnum
CREATE TYPE "ValuationMethod" AS ENUM ('FIFO', 'LIFO', 'WEIGHTED_AVERAGE', 'STANDARD');

-- CreateEnum
CREATE TYPE "PickingStrategy" AS ENUM ('FIFO', 'LIFO', 'FEFO');

-- CreateEnum
CREATE TYPE "UomCategory" AS ENUM ('COUNT', 'WEIGHT', 'LENGTH', 'VOLUME', 'AREA', 'TIME');

-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('WAREHOUSE', 'PLANT', 'STORE', 'TRANSIT', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "ZoneType" AS ENUM ('RECEIVING', 'STORAGE', 'PICKING', 'PACKING', 'SHIPPING', 'QUARANTINE', 'RETURNS', 'PRODUCTION', 'STAGING');

-- CreateEnum
CREATE TYPE "BinType" AS ENUM ('PALLET_RACK', 'SHELF', 'BULK_FLOOR', 'BIN_BOX', 'CAROUSEL', 'HAZMAT', 'COLD_STORAGE');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('AVAILABLE', 'QUARANTINE', 'BLOCKED', 'DAMAGED', 'EXPIRED', 'IN_TRANSIT');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'EXPIRED', 'BLOCKED', 'QUARANTINE');

-- CreateEnum
CREATE TYPE "MovementDirection" AS ENUM ('IN', 'OUT', 'INTERNAL');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('OPENING_BALANCE', 'PURCHASE_RECEIPT', 'PURCHASE_RETURN', 'SALES_ISSUE', 'SALES_RETURN', 'TRANSFER_OUT', 'TRANSFER_IN', 'INTERNAL_MOVE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_RECEIPT', 'SCRAP', 'CYCLE_COUNT_GAIN', 'CYCLE_COUNT_LOSS', 'EXPIRY_WRITE_OFF');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'PARTIALLY_RELEASED', 'RELEASED', 'CONSUMED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReservationReferenceType" AS ENUM ('SALES_ORDER', 'PRODUCTION_ORDER', 'MATERIAL_REQUISITION', 'PICK_LIST', 'MANUAL');

-- CreateEnum
CREATE TYPE "StockAlertType" AS ENUM ('REORDER_POINT', 'BELOW_SAFETY_STOCK', 'STOCKOUT', 'OVERSTOCK', 'EXPIRY_WARNING', 'EXPIRED', 'NEGATIVE_STOCK');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "StockCountType" AS ENUM ('CYCLE', 'FULL', 'SPOT');

-- CreateEnum
CREATE TYPE "StockCountStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PalletStatus" AS ENUM ('EMPTY', 'IN_USE', 'STAGED', 'SHIPPED', 'DAMAGED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PickListStatus" AS ENUM ('DRAFT', 'RELEASED', 'IN_PROGRESS', 'PICKED', 'PACKED', 'SHIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('OPEN', 'PACKED', 'SHIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BomStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "BomChangeType" AS ENUM ('CREATED', 'HEADER_UPDATED', 'COMPONENT_ADDED', 'COMPONENT_UPDATED', 'COMPONENT_REMOVED', 'SUBSTITUTE_ADDED', 'SUBSTITUTE_REMOVED', 'STATUS_CHANGED', 'REVISED', 'COST_ROLLED_UP');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ON_HOLD', 'BLACKLISTED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PurchaseRequisitionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PARTIALLY_CONVERTED', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderLineStatus" AS ENUM ('OPEN', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GrnStatus" AS ENUM ('DRAFT', 'PENDING_QC', 'QC_IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QcResult" AS ENUM ('PENDING', 'PASS', 'FAIL', 'CONDITIONAL_PASS');

-- CreateEnum
CREATE TYPE "MaterialRequisitionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PARTIALLY_ISSUED', 'ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('DRAFT', 'PLANNED', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApprovalTargetObject" ADD VALUE 'PURCHASE_ORDER';
ALTER TYPE "ApprovalTargetObject" ADD VALUE 'PURCHASE_REQUISITION';
ALTER TYPE "ApprovalTargetObject" ADD VALUE 'BOM';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditCategory" ADD VALUE 'INVENTORY_MANAGEMENT';
ALTER TYPE "AuditCategory" ADD VALUE 'WAREHOUSE_MANAGEMENT';
ALTER TYPE "AuditCategory" ADD VALUE 'PROCUREMENT';
ALTER TYPE "AuditCategory" ADD VALUE 'BOM_MANAGEMENT';
ALTER TYPE "AuditCategory" ADD VALUE 'PRODUCTION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'STOCK_ALERT';
ALTER TYPE "NotificationType" ADD VALUE 'PURCHASE_ORDER_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'PURCHASE_ORDER_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'GOODS_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'QC_FAILED';
ALTER TYPE "NotificationType" ADD VALUE 'MATERIAL_SHORTAGE';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "hsn_code" TEXT,
ADD COLUMN     "is_manufactured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_purchasable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_sellable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_stock_tracked" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "item_type" "ItemType" NOT NULL DEFAULT 'FINISHED_GOOD',
ADD COLUMN     "picking_strategy" "PickingStrategy" NOT NULL DEFAULT 'FIFO',
ADD COLUMN     "shelf_life_days" INTEGER,
ADD COLUMN     "standard_cost" DECIMAL(18,4),
ADD COLUMN     "tracking_type" "TrackingType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "uom_id" INTEGER,
ADD COLUMN     "valuation_method" "ValuationMethod" NOT NULL DEFAULT 'FIFO',
ADD COLUMN     "volume_m3" DECIMAL(18,6),
ADD COLUMN     "weight_kg" DECIMAL(18,4);

-- CreateTable
CREATE TABLE "number_sequences" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "padding" INTEGER NOT NULL DEFAULT 5,
    "reset_period" TEXT NOT NULL DEFAULT 'YEARLY',
    "period_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "UomCategory" NOT NULL,
    "base_factor" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "is_base_unit" BOOLEAN NOT NULL DEFAULT false,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WarehouseType" NOT NULL DEFAULT 'WAREHOUSE',
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT DEFAULT 'India',
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "gst_number" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "allow_negative_stock" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_zones" (
    "id" SERIAL NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zone_type" "ZoneType" NOT NULL DEFAULT 'STORAGE',
    "temperature_controlled" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_bins" (
    "id" SERIAL NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "zone_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "aisle" TEXT,
    "rack" TEXT,
    "level" TEXT,
    "position" TEXT,
    "bin_type" "BinType" NOT NULL DEFAULT 'SHELF',
    "pick_sequence" INTEGER NOT NULL DEFAULT 0,
    "max_weight_kg" DECIMAL(18,4),
    "max_volume_m3" DECIMAL(18,6),
    "is_pick_face" BOOLEAN NOT NULL DEFAULT false,
    "is_receiving" BOOLEAN NOT NULL DEFAULT false,
    "is_shipping" BOOLEAN NOT NULL DEFAULT false,
    "is_quarantine" BOOLEAN NOT NULL DEFAULT false,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_bins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pallets" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "bin_id" INTEGER,
    "status" "PalletStatus" NOT NULL DEFAULT 'EMPTY',
    "gross_weight_kg" DECIMAL(18,4),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_lots" (
    "id" SERIAL NOT NULL,
    "lot_number" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "origin_warehouse_id" INTEGER NOT NULL,
    "batch_number" TEXT,
    "serial_number" TEXT,
    "manufactured_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "original_quantity" DECIMAL(18,4) NOT NULL,
    "remaining_quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,4) NOT NULL,
    "status" "LotStatus" NOT NULL DEFAULT 'ACTIVE',
    "supplier_id" INTEGER,
    "source_type" TEXT NOT NULL,
    "source_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balances" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "bin_id" INTEGER NOT NULL,
    "lot_id" INTEGER NOT NULL,
    "pallet_id" INTEGER,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reserved_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "StockStatus" NOT NULL DEFAULT 'AVAILABLE',
    "last_movement_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" SERIAL NOT NULL,
    "movement_number" TEXT NOT NULL,
    "movement_type" "StockMovementType" NOT NULL,
    "direction" "MovementDirection" NOT NULL,
    "product_id" INTEGER NOT NULL,
    "lot_id" INTEGER,
    "uom_id" INTEGER,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "from_warehouse_id" INTEGER,
    "from_bin_id" INTEGER,
    "to_warehouse_id" INTEGER,
    "to_bin_id" INTEGER,
    "reference_type" TEXT,
    "reference_id" INTEGER,
    "reference_number" TEXT,
    "reason_code" TEXT,
    "notes" TEXT,
    "performed_by_id" INTEGER,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversal_of_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "lot_id" INTEGER,
    "quantity" DECIMAL(18,4) NOT NULL,
    "released_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "reference_type" "ReservationReferenceType" NOT NULL,
    "reference_id" INTEGER NOT NULL,
    "reference_number" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reorder_rules" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "safety_stock" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reorder_point" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reorder_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "maximum_stock" DECIMAL(18,4),
    "lead_time_days" INTEGER NOT NULL DEFAULT 0,
    "auto_requisition" BOOLEAN NOT NULL DEFAULT false,
    "preferred_supplier_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_evaluated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reorder_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_alerts" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "alert_type" "StockAlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "current_quantity" DECIMAL(18,4) NOT NULL,
    "threshold_quantity" DECIMAL(18,4) NOT NULL,
    "shortfall_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL,
    "lot_id" INTEGER,
    "acknowledged_by_id" INTEGER,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_counts" (
    "id" SERIAL NOT NULL,
    "count_number" TEXT NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "count_type" "StockCountType" NOT NULL DEFAULT 'CYCLE',
    "status" "StockCountStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_date" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "counted_by_id" INTEGER,
    "approved_by_id" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_lines" (
    "id" SERIAL NOT NULL,
    "stock_count_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "bin_id" INTEGER NOT NULL,
    "lot_id" INTEGER,
    "system_quantity" DECIMAL(18,4) NOT NULL,
    "counted_quantity" DECIMAL(18,4),
    "variance_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "variance_value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reason_code" TEXT,
    "is_posted" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "putaway_tasks" (
    "id" SERIAL NOT NULL,
    "task_number" TEXT NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "lot_id" INTEGER NOT NULL,
    "from_bin_id" INTEGER NOT NULL,
    "to_bin_id" INTEGER,
    "quantity" DECIMAL(18,4) NOT NULL,
    "moved_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "grn_line_id" INTEGER,
    "assigned_to_id" INTEGER,
    "completed_by_id" INTEGER,
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "putaway_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pick_lists" (
    "id" SERIAL NOT NULL,
    "pick_list_number" TEXT NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "status" "PickListStatus" NOT NULL DEFAULT 'DRAFT',
    "strategy" "PickingStrategy" NOT NULL DEFAULT 'FIFO',
    "reference_type" TEXT NOT NULL,
    "reference_id" INTEGER NOT NULL,
    "reference_number" TEXT,
    "assigned_to_id" INTEGER,
    "released_by_id" INTEGER,
    "released_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pick_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pick_tasks" (
    "id" SERIAL NOT NULL,
    "pick_list_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "lot_id" INTEGER NOT NULL,
    "bin_id" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "requested_quantity" DECIMAL(18,4) NOT NULL,
    "picked_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "short_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "picked_by_id" INTEGER,
    "picked_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pick_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" SERIAL NOT NULL,
    "package_number" TEXT NOT NULL,
    "pick_list_id" INTEGER NOT NULL,
    "pallet_id" INTEGER,
    "status" "PackageStatus" NOT NULL DEFAULT 'OPEN',
    "gross_weight_kg" DECIMAL(18,4),
    "length_cm" DECIMAL(18,2),
    "width_cm" DECIMAL(18,2),
    "height_cm" DECIMAL(18,2),
    "tracking_number" TEXT,
    "carrier" TEXT,
    "packed_by_id" INTEGER,
    "packed_at" TIMESTAMP(3),
    "shipped_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_lines" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "pick_task_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "lot_id" INTEGER NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills_of_materials" (
    "id" SERIAL NOT NULL,
    "bom_number" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "revision" TEXT NOT NULL DEFAULT 'A',
    "status" "BomStatus" NOT NULL DEFAULT 'DRAFT',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "output_quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "uom_id" INTEGER,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "rolled_up_cost" DECIMAL(18,4),
    "costed_at" TIMESTAMP(3),
    "labor_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "overhead_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "previous_version_id" INTEGER,
    "created_by_id" INTEGER NOT NULL,
    "approved_by_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_of_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_components" (
    "id" SERIAL NOT NULL,
    "bom_id" INTEGER NOT NULL,
    "component_product_id" INTEGER NOT NULL,
    "line_number" INTEGER NOT NULL DEFAULT 0,
    "quantity" DECIMAL(18,4) NOT NULL,
    "uom_id" INTEGER,
    "scrap_percent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "is_phantom" BOOLEAN NOT NULL DEFAULT false,
    "operation_sequence" INTEGER,
    "reference_designator" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bom_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_component_substitutes" (
    "id" SERIAL NOT NULL,
    "bom_component_id" INTEGER NOT NULL,
    "substitute_product_id" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "conversion_factor" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bom_component_substitutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_change_logs" (
    "id" SERIAL NOT NULL,
    "bom_id" INTEGER NOT NULL,
    "change_type" "BomChangeType" NOT NULL,
    "field_name" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "description" TEXT NOT NULL,
    "reason" TEXT,
    "changed_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bom_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'DRAFT',
    "email" TEXT,
    "phone" TEXT,
    "country_code" TEXT DEFAULT '91',
    "website" TEXT,
    "gst_number" TEXT,
    "pan_number" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT DEFAULT 'India',
    "currency_code" TEXT NOT NULL DEFAULT 'INR',
    "payment_terms" TEXT,
    "credit_days" INTEGER NOT NULL DEFAULT 0,
    "incoterms" TEXT,
    "lead_time_days" INTEGER NOT NULL DEFAULT 0,
    "min_order_value" DECIMAL(18,2),
    "bank_name" TEXT,
    "bank_account_number" TEXT,
    "bank_ifsc" TEXT,
    "notes" TEXT,
    "is_blacklisted" BOOLEAN NOT NULL DEFAULT false,
    "blacklist_reason" TEXT,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_contacts" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_products" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "supplier_sku" TEXT,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'INR',
    "min_order_quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "pack_size" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "lead_time_days" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMP(3),
    "is_preferred" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_price_tiers" (
    "id" SERIAL NOT NULL,
    "supplier_product_id" INTEGER NOT NULL,
    "min_quantity" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_performance" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "total_order_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "receipts_count" INTEGER NOT NULL DEFAULT 0,
    "on_time_receipts" INTEGER NOT NULL DEFAULT 0,
    "late_receipts" INTEGER NOT NULL DEFAULT 0,
    "on_time_delivery_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "received_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "accepted_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "rejected_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "quality_acceptance_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "average_lead_time_days" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "price_variance_percent" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "fill_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "overall_score" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requisitions" (
    "id" SERIAL NOT NULL,
    "requisition_number" TEXT NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "status" "PurchaseRequisitionStatus" NOT NULL DEFAULT 'DRAFT',
    "origin" TEXT NOT NULL DEFAULT 'MANUAL',
    "required_by_date" TIMESTAMP(3),
    "suggested_supplier_id" INTEGER,
    "estimated_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "justification" TEXT,
    "requested_by_id" INTEGER NOT NULL,
    "approved_by_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requisition_lines" (
    "id" SERIAL NOT NULL,
    "requisition_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "ordered_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "uom_id" INTEGER,
    "estimated_unit_price" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "required_by_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requisition_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" SERIAL NOT NULL,
    "po_number" TEXT NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "requisition_id" INTEGER,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_delivery_date" TIMESTAMP(3),
    "promised_date" TIMESTAMP(3),
    "currency_code" TEXT NOT NULL DEFAULT 'INR',
    "exchange_rate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "shipping_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "payment_terms" TEXT,
    "incoterms" TEXT,
    "ship_to_address" TEXT,
    "notes" TEXT,
    "internal_notes" TEXT,
    "cancellation_reason" TEXT,
    "sent_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_by_id" INTEGER NOT NULL,
    "approved_by_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" SERIAL NOT NULL,
    "purchase_order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "requisition_line_id" INTEGER,
    "line_number" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "uom_id" INTEGER,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "discount_percent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "tax_percent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "received_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "accepted_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "rejected_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "expected_date" TIMESTAMP(3),
    "status" "PurchaseOrderLineStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_notes" (
    "id" SERIAL NOT NULL,
    "grn_number" TEXT NOT NULL,
    "purchase_order_id" INTEGER,
    "supplier_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "status" "GrnStatus" NOT NULL DEFAULT 'DRAFT',
    "received_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplier_invoice_number" TEXT,
    "supplier_invoice_date" TIMESTAMP(3),
    "vehicle_number" TEXT,
    "lr_number" TEXT,
    "is_on_time" BOOLEAN,
    "delay_days" INTEGER,
    "total_received_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_accepted_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_rejected_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "posted_at" TIMESTAMP(3),
    "received_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipt_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" SERIAL NOT NULL,
    "grn_id" INTEGER NOT NULL,
    "purchase_order_line_id" INTEGER,
    "product_id" INTEGER NOT NULL,
    "line_number" INTEGER NOT NULL DEFAULT 0,
    "received_quantity" DECIMAL(18,4) NOT NULL,
    "accepted_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "rejected_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "uom_id" INTEGER,
    "unit_cost" DECIMAL(18,4) NOT NULL,
    "batch_number" TEXT,
    "serial_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "manufactured_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "qc_result" "QcResult" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "lot_id" INTEGER,
    "putaway_bin_id" INTEGER,
    "is_posted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_checks" (
    "id" SERIAL NOT NULL,
    "qc_number" TEXT NOT NULL,
    "grn_id" INTEGER NOT NULL,
    "grn_line_id" INTEGER NOT NULL,
    "sample_size" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "inspected_quantity" DECIMAL(18,4) NOT NULL,
    "accepted_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "rejected_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "result" "QcResult" NOT NULL DEFAULT 'PENDING',
    "defect_type" TEXT,
    "remarks" TEXT,
    "inspected_by_id" INTEGER NOT NULL,
    "inspected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_check_parameters" (
    "id" SERIAL NOT NULL,
    "quality_check_id" INTEGER NOT NULL,
    "parameter_name" TEXT NOT NULL,
    "specification" TEXT,
    "min_value" DECIMAL(18,4),
    "max_value" DECIMAL(18,4),
    "observed_value" TEXT,
    "is_passed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_check_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_requisitions" (
    "id" SERIAL NOT NULL,
    "requisition_number" TEXT NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "production_order_id" INTEGER,
    "status" "MaterialRequisitionStatus" NOT NULL DEFAULT 'DRAFT',
    "required_by_date" TIMESTAMP(3),
    "purpose" TEXT,
    "notes" TEXT,
    "requested_by_id" INTEGER NOT NULL,
    "issued_by_id" INTEGER,
    "issued_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_requisition_lines" (
    "id" SERIAL NOT NULL,
    "requisition_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "requested_quantity" DECIMAL(18,4) NOT NULL,
    "issued_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "uom_id" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_requisition_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" SERIAL NOT NULL,
    "order_number" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "bom_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "planned_quantity" DECIMAL(18,4) NOT NULL,
    "produced_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "scrapped_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "planned_start_date" TIMESTAMP(3),
    "planned_end_date" TIMESTAMP(3),
    "actual_start_date" TIMESTAMP(3),
    "actual_end_date" TIMESTAMP(3),
    "planned_material_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "actual_material_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_components" (
    "id" SERIAL NOT NULL,
    "production_order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "required_quantity" DECIMAL(18,4) NOT NULL,
    "issued_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "consumed_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "wasted_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "scrap_percent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "standard_unit_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_order_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_consumption" (
    "id" SERIAL NOT NULL,
    "production_order_id" INTEGER NOT NULL,
    "lot_id" INTEGER NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "consumption_type" TEXT NOT NULL,
    "unit_cost" DECIMAL(18,4) NOT NULL,
    "total_cost" DECIMAL(18,4) NOT NULL,
    "reason_code" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_order_consumption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "number_sequences_key_key" ON "number_sequences"("key");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_code_key" ON "units_of_measure"("code");

-- CreateIndex
CREATE INDEX "units_of_measure_category_idx" ON "units_of_measure"("category");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX "warehouses_is_active_idx" ON "warehouses"("is_active");

-- CreateIndex
CREATE INDEX "warehouse_zones_zone_type_idx" ON "warehouse_zones"("zone_type");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_zones_warehouse_id_code_key" ON "warehouse_zones"("warehouse_id", "code");

-- CreateIndex
CREATE INDEX "storage_bins_zone_id_idx" ON "storage_bins"("zone_id");

-- CreateIndex
CREATE INDEX "storage_bins_pick_sequence_idx" ON "storage_bins"("pick_sequence");

-- CreateIndex
CREATE UNIQUE INDEX "storage_bins_warehouse_id_code_key" ON "storage_bins"("warehouse_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "pallets_code_key" ON "pallets"("code");

-- CreateIndex
CREATE INDEX "pallets_warehouse_id_status_idx" ON "pallets"("warehouse_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_lots_lot_number_key" ON "stock_lots"("lot_number");

-- CreateIndex
CREATE INDEX "stock_lots_product_id_status_idx" ON "stock_lots"("product_id", "status");

-- CreateIndex
CREATE INDEX "stock_lots_expiry_date_idx" ON "stock_lots"("expiry_date");

-- CreateIndex
CREATE INDEX "stock_lots_received_at_idx" ON "stock_lots"("received_at");

-- CreateIndex
CREATE INDEX "stock_lots_serial_number_idx" ON "stock_lots"("serial_number");

-- CreateIndex
CREATE INDEX "stock_lots_batch_number_idx" ON "stock_lots"("batch_number");

-- CreateIndex
CREATE INDEX "stock_balances_product_id_warehouse_id_idx" ON "stock_balances"("product_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "stock_balances_warehouse_id_bin_id_idx" ON "stock_balances"("warehouse_id", "bin_id");

-- CreateIndex
CREATE INDEX "stock_balances_lot_id_idx" ON "stock_balances"("lot_id");

-- CreateIndex
CREATE INDEX "stock_balances_status_idx" ON "stock_balances"("status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_movement_number_key" ON "stock_movements"("movement_number");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_reversal_of_id_key" ON "stock_movements"("reversal_of_id");

-- CreateIndex
CREATE INDEX "stock_movements_product_id_occurred_at_idx" ON "stock_movements"("product_id", "occurred_at");

-- CreateIndex
CREATE INDEX "stock_movements_movement_type_idx" ON "stock_movements"("movement_type");

-- CreateIndex
CREATE INDEX "stock_movements_reference_type_reference_id_idx" ON "stock_movements"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "stock_movements_occurred_at_idx" ON "stock_movements"("occurred_at");

-- CreateIndex
CREATE INDEX "stock_reservations_product_id_warehouse_id_status_idx" ON "stock_reservations"("product_id", "warehouse_id", "status");

-- CreateIndex
CREATE INDEX "stock_reservations_reference_type_reference_id_idx" ON "stock_reservations"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "reorder_rules_is_active_idx" ON "reorder_rules"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "reorder_rules_product_id_warehouse_id_key" ON "reorder_rules"("product_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "stock_alerts_status_severity_idx" ON "stock_alerts"("status", "severity");

-- CreateIndex
CREATE INDEX "stock_alerts_product_id_warehouse_id_alert_type_idx" ON "stock_alerts"("product_id", "warehouse_id", "alert_type");

-- CreateIndex
CREATE UNIQUE INDEX "stock_counts_count_number_key" ON "stock_counts"("count_number");

-- CreateIndex
CREATE INDEX "stock_counts_warehouse_id_status_idx" ON "stock_counts"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "stock_count_lines_stock_count_id_idx" ON "stock_count_lines"("stock_count_id");

-- CreateIndex
CREATE UNIQUE INDEX "putaway_tasks_task_number_key" ON "putaway_tasks"("task_number");

-- CreateIndex
CREATE INDEX "putaway_tasks_warehouse_id_status_idx" ON "putaway_tasks"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "putaway_tasks_assigned_to_id_status_idx" ON "putaway_tasks"("assigned_to_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pick_lists_pick_list_number_key" ON "pick_lists"("pick_list_number");

-- CreateIndex
CREATE INDEX "pick_lists_warehouse_id_status_idx" ON "pick_lists"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "pick_lists_reference_type_reference_id_idx" ON "pick_lists"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "pick_tasks_pick_list_id_sequence_idx" ON "pick_tasks"("pick_list_id", "sequence");

-- CreateIndex
CREATE INDEX "pick_tasks_status_idx" ON "pick_tasks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "packages_package_number_key" ON "packages"("package_number");

-- CreateIndex
CREATE INDEX "packages_pick_list_id_idx" ON "packages"("pick_list_id");

-- CreateIndex
CREATE INDEX "package_lines_package_id_idx" ON "package_lines"("package_id");

-- CreateIndex
CREATE UNIQUE INDEX "bills_of_materials_bom_number_key" ON "bills_of_materials"("bom_number");

-- CreateIndex
CREATE UNIQUE INDEX "bills_of_materials_previous_version_id_key" ON "bills_of_materials"("previous_version_id");

-- CreateIndex
CREATE INDEX "bills_of_materials_status_idx" ON "bills_of_materials"("status");

-- CreateIndex
CREATE INDEX "bills_of_materials_product_id_is_default_idx" ON "bills_of_materials"("product_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "bills_of_materials_product_id_version_key" ON "bills_of_materials"("product_id", "version");

-- CreateIndex
CREATE INDEX "bom_components_component_product_id_idx" ON "bom_components"("component_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "bom_components_bom_id_component_product_id_key" ON "bom_components"("bom_id", "component_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "bom_component_substitutes_bom_component_id_substitute_produ_key" ON "bom_component_substitutes"("bom_component_id", "substitute_product_id");

-- CreateIndex
CREATE INDEX "bom_change_logs_bom_id_created_at_idx" ON "bom_change_logs"("bom_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE INDEX "suppliers_status_idx" ON "suppliers"("status");

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "supplier_contacts_supplier_id_idx" ON "supplier_contacts"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_products_product_id_is_active_idx" ON "supplier_products"("product_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_products_supplier_id_product_id_valid_from_key" ON "supplier_products"("supplier_id", "product_id", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_price_tiers_supplier_product_id_min_quantity_key" ON "supplier_price_tiers"("supplier_product_id", "min_quantity");

-- CreateIndex
CREATE INDEX "supplier_performance_supplier_id_computed_at_idx" ON "supplier_performance"("supplier_id", "computed_at");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_performance_supplier_id_period_start_period_end_key" ON "supplier_performance"("supplier_id", "period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requisitions_requisition_number_key" ON "purchase_requisitions"("requisition_number");

-- CreateIndex
CREATE INDEX "purchase_requisitions_status_idx" ON "purchase_requisitions"("status");

-- CreateIndex
CREATE INDEX "purchase_requisitions_warehouse_id_idx" ON "purchase_requisitions"("warehouse_id");

-- CreateIndex
CREATE INDEX "purchase_requisition_lines_requisition_id_idx" ON "purchase_requisition_lines"("requisition_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_status_idx" ON "purchase_orders"("supplier_id", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_order_date_idx" ON "purchase_orders"("order_date");

-- CreateIndex
CREATE INDEX "purchase_order_lines_purchase_order_id_idx" ON "purchase_order_lines"("purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_order_lines_product_id_idx" ON "purchase_order_lines"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipt_notes_grn_number_key" ON "goods_receipt_notes"("grn_number");

-- CreateIndex
CREATE INDEX "goods_receipt_notes_supplier_id_idx" ON "goods_receipt_notes"("supplier_id");

-- CreateIndex
CREATE INDEX "goods_receipt_notes_purchase_order_id_idx" ON "goods_receipt_notes"("purchase_order_id");

-- CreateIndex
CREATE INDEX "goods_receipt_notes_status_idx" ON "goods_receipt_notes"("status");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_grn_id_idx" ON "goods_receipt_lines"("grn_id");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_product_id_idx" ON "goods_receipt_lines"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "quality_checks_qc_number_key" ON "quality_checks"("qc_number");

-- CreateIndex
CREATE INDEX "quality_checks_grn_id_idx" ON "quality_checks"("grn_id");

-- CreateIndex
CREATE INDEX "quality_checks_result_idx" ON "quality_checks"("result");

-- CreateIndex
CREATE INDEX "quality_check_parameters_quality_check_id_idx" ON "quality_check_parameters"("quality_check_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_requisitions_requisition_number_key" ON "material_requisitions"("requisition_number");

-- CreateIndex
CREATE INDEX "material_requisitions_warehouse_id_status_idx" ON "material_requisitions"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "material_requisition_lines_requisition_id_idx" ON "material_requisition_lines"("requisition_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_order_number_key" ON "production_orders"("order_number");

-- CreateIndex
CREATE INDEX "production_orders_status_idx" ON "production_orders"("status");

-- CreateIndex
CREATE INDEX "production_orders_product_id_idx" ON "production_orders"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_order_components_production_order_id_product_id_key" ON "production_order_components"("production_order_id", "product_id");

-- CreateIndex
CREATE INDEX "production_order_consumption_production_order_id_idx" ON "production_order_consumption"("production_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "products_item_type_idx" ON "products"("item_type");

-- CreateIndex
CREATE INDEX "products_is_purchasable_idx" ON "products"("is_purchasable");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_bins" ADD CONSTRAINT "storage_bins_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_bins" ADD CONSTRAINT "storage_bins_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "storage_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_origin_warehouse_id_fkey" FOREIGN KEY ("origin_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "storage_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_pallet_id_fkey" FOREIGN KEY ("pallet_id") REFERENCES "pallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_from_warehouse_id_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_from_bin_id_fkey" FOREIGN KEY ("from_bin_id") REFERENCES "storage_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_to_bin_id_fkey" FOREIGN KEY ("to_bin_id") REFERENCES "storage_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "stock_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_preferred_supplier_id_fkey" FOREIGN KEY ("preferred_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_acknowledged_by_id_fkey" FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_counted_by_id_fkey" FOREIGN KEY ("counted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_stock_count_id_fkey" FOREIGN KEY ("stock_count_id") REFERENCES "stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "storage_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "putaway_tasks" ADD CONSTRAINT "putaway_tasks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "putaway_tasks" ADD CONSTRAINT "putaway_tasks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "putaway_tasks" ADD CONSTRAINT "putaway_tasks_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "putaway_tasks" ADD CONSTRAINT "putaway_tasks_from_bin_id_fkey" FOREIGN KEY ("from_bin_id") REFERENCES "storage_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "putaway_tasks" ADD CONSTRAINT "putaway_tasks_to_bin_id_fkey" FOREIGN KEY ("to_bin_id") REFERENCES "storage_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "putaway_tasks" ADD CONSTRAINT "putaway_tasks_grn_line_id_fkey" FOREIGN KEY ("grn_line_id") REFERENCES "goods_receipt_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "putaway_tasks" ADD CONSTRAINT "putaway_tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "putaway_tasks" ADD CONSTRAINT "putaway_tasks_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_lists" ADD CONSTRAINT "pick_lists_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_lists" ADD CONSTRAINT "pick_lists_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_lists" ADD CONSTRAINT "pick_lists_released_by_id_fkey" FOREIGN KEY ("released_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_pick_list_id_fkey" FOREIGN KEY ("pick_list_id") REFERENCES "pick_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "storage_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_picked_by_id_fkey" FOREIGN KEY ("picked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_pick_list_id_fkey" FOREIGN KEY ("pick_list_id") REFERENCES "pick_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_pallet_id_fkey" FOREIGN KEY ("pallet_id") REFERENCES "pallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_packed_by_id_fkey" FOREIGN KEY ("packed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_lines" ADD CONSTRAINT "package_lines_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_lines" ADD CONSTRAINT "package_lines_pick_task_id_fkey" FOREIGN KEY ("pick_task_id") REFERENCES "pick_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_lines" ADD CONSTRAINT "package_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_lines" ADD CONSTRAINT "package_lines_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_materials" ADD CONSTRAINT "bills_of_materials_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_materials" ADD CONSTRAINT "bills_of_materials_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_materials" ADD CONSTRAINT "bills_of_materials_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_materials" ADD CONSTRAINT "bills_of_materials_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_materials" ADD CONSTRAINT "bills_of_materials_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "bills_of_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_components" ADD CONSTRAINT "bom_components_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "bills_of_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_components" ADD CONSTRAINT "bom_components_component_product_id_fkey" FOREIGN KEY ("component_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_components" ADD CONSTRAINT "bom_components_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_component_substitutes" ADD CONSTRAINT "bom_component_substitutes_bom_component_id_fkey" FOREIGN KEY ("bom_component_id") REFERENCES "bom_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_component_substitutes" ADD CONSTRAINT "bom_component_substitutes_substitute_product_id_fkey" FOREIGN KEY ("substitute_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_change_logs" ADD CONSTRAINT "bom_change_logs_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "bills_of_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_change_logs" ADD CONSTRAINT "bom_change_logs_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_price_tiers" ADD CONSTRAINT "supplier_price_tiers_supplier_product_id_fkey" FOREIGN KEY ("supplier_product_id") REFERENCES "supplier_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_performance" ADD CONSTRAINT "supplier_performance_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_suggested_supplier_id_fkey" FOREIGN KEY ("suggested_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "purchase_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "purchase_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_requisition_line_id_fkey" FOREIGN KEY ("requisition_line_id") REFERENCES "purchase_requisition_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "goods_receipt_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_purchase_order_line_id_fkey" FOREIGN KEY ("purchase_order_line_id") REFERENCES "purchase_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_putaway_bin_id_fkey" FOREIGN KEY ("putaway_bin_id") REFERENCES "storage_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "goods_receipt_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_grn_line_id_fkey" FOREIGN KEY ("grn_line_id") REFERENCES "goods_receipt_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_inspected_by_id_fkey" FOREIGN KEY ("inspected_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_check_parameters" ADD CONSTRAINT "quality_check_parameters_quality_check_id_fkey" FOREIGN KEY ("quality_check_id") REFERENCES "quality_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisitions" ADD CONSTRAINT "material_requisitions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisitions" ADD CONSTRAINT "material_requisitions_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisitions" ADD CONSTRAINT "material_requisitions_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisitions" ADD CONSTRAINT "material_requisitions_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisition_lines" ADD CONSTRAINT "material_requisition_lines_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "material_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisition_lines" ADD CONSTRAINT "material_requisition_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisition_lines" ADD CONSTRAINT "material_requisition_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "bills_of_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_components" ADD CONSTRAINT "production_order_components_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_components" ADD CONSTRAINT "production_order_components_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_consumption" ADD CONSTRAINT "production_order_consumption_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_consumption" ADD CONSTRAINT "production_order_consumption_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================================
-- Hand-written integrity rules that Prisma's schema language cannot express.
-- All of these are CHECK constraints or partial/expression indexes, which the
-- migration engine does not model, so later `prisma migrate` runs leave them
-- in place instead of trying to drop them.
-- ============================================================================

-- A physical stock slot is (product, warehouse, bin, lot, pallet). Postgres
-- treats NULLs as distinct in a plain UNIQUE, which would let two "no pallet"
-- rows exist for the same slot and silently split the on-hand quantity.
-- COALESCE folds NULL to 0 so the slot is genuinely unique either way.
CREATE UNIQUE INDEX "stock_balances_slot_key"
  ON "stock_balances" ("product_id", "warehouse_id", "bin_id", "lot_id", COALESCE("pallet_id", 0));

-- Reservations are soft allocations; they can never be negative.
ALTER TABLE "stock_balances"
  ADD CONSTRAINT "stock_balances_reserved_non_negative" CHECK ("reserved_quantity" >= 0);

-- Cost layers are consumed, never over-consumed.
ALTER TABLE "stock_lots"
  ADD CONSTRAINT "stock_lots_remaining_non_negative" CHECK ("remaining_quantity" >= 0);

-- Ledger rows always carry a positive magnitude; `direction` carries the sign.
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_quantity_positive" CHECK ("quantity" > 0);

-- A component line with zero or negative quantity would break cost roll-up.
ALTER TABLE "bom_components"
  ADD CONSTRAINT "bom_components_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "reorder_rules"
  ADD CONSTRAINT "reorder_rules_thresholds_non_negative"
  CHECK ("safety_stock" >= 0 AND "reorder_point" >= 0 AND "reorder_quantity" >= 0);

-- At most one default warehouse.
CREATE UNIQUE INDEX "warehouses_single_default_key"
  ON "warehouses" ("is_default") WHERE "is_default" = true;

-- At most one default BOM per product.
CREATE UNIQUE INDEX "bills_of_materials_single_default_per_product_key"
  ON "bills_of_materials" ("product_id") WHERE "is_default" = true;

-- At most one OPEN alert of a given type per product/warehouse, so the alert
-- engine can be re-run on a schedule without flooding the queue.
CREATE UNIQUE INDEX "stock_alerts_single_open_key"
  ON "stock_alerts" ("product_id", "warehouse_id", "alert_type") WHERE "status" = 'OPEN';

-- Hot path for "what is still allocated to this document".
CREATE INDEX "stock_reservations_active_key"
  ON "stock_reservations" ("reference_type", "reference_id") WHERE "status" = 'ACTIVE';
