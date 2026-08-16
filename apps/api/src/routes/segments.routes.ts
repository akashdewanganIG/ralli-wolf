import { Router } from "express";
import { SegmentController } from "../controllers/segment.controller.js";

const router = Router();
const controller = new SegmentController();

router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);
router.post("/:id/resolve", controller.resolve);

export default router;
