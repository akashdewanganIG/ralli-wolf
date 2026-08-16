import { Router } from "express";
import { SalesOrderController } from "../controllers/salesOrder.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { UserRole } from "@prisma/client";

const router = Router();
const salesOrderController = new SalesOrderController();

router.use(requireAuth);
router.use(requireRole([UserRole.ADMIN]));

// GET /api/sales-orders - List all sales orders (paginated)
router.get(
  "/",
  salesOrderController.getAllSalesOrders.bind(salesOrderController)
);

// GET /api/sales-orders/:id/get-order-details - Get order details
router.get(
  "/:id/get-order-details",
  salesOrderController.getOrderDetails.bind(salesOrderController)
);

// GET /api/sales-orders/:id/line-items - Get line items
router.get(
  "/:id/line-items",
  salesOrderController.getLineItems.bind(salesOrderController)
);

// GET /api/sales-orders/:id/pdf - Generate sales order PDF
router.get(
  "/:id/pdf",
  salesOrderController.generatePdf.bind(salesOrderController)
);

export default router;
