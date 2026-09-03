import { Router } from "express";
import { OrderController } from "../controllers/order.controller.js";
import { requireSubdealerAuth } from "../middleware/auth.middleware.js";

const router = Router();
const orderController = new OrderController();

router.post(
  "/",
  requireSubdealerAuth,
  orderController.createOrder.bind(orderController)
);

export default router;
