import { Router } from "express";
import { SegmentController } from "../controllers/segment.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();
const controller = new SegmentController();

router.use(requireAuth, requirePermission("campaigns.view"));

router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", requirePermission("campaigns.manage"), controller.create);
router.put("/:id", requirePermission("campaigns.manage"), controller.update);
router.delete("/:id", requirePermission("campaigns.manage"), controller.remove);
router.post("/:id/resolve", controller.resolve);

export default router;
