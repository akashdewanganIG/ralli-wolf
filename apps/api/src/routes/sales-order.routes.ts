import { Router } from "express";
import { SalesOrderController } from "../controllers/sales-order.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();
const salesOrderController = new SalesOrderController();

router.use(requireAuth);
router.use(requirePermission("salesOrders.view"));

router.get(
  "/",
  salesOrderController.getAllSalesOrders.bind(salesOrderController)
);

router.get(
  "/:id/get-order-details",
  salesOrderController.getOrderDetails.bind(salesOrderController)
);

router.get(
  "/:id/line-items",
  salesOrderController.getLineItems.bind(salesOrderController)
);

router.get(
  "/:id/pdf",
  salesOrderController.generatePdf.bind(salesOrderController)
);

export default router;
