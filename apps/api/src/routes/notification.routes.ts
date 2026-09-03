import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { NotificationController } from "../controllers/notification.controller.js";

const router = Router();
const controller = new NotificationController();

router.use(requireAuth);

router.get("/", controller.getNotifications.bind(controller));

router.get("/preferences", controller.getPreferences.bind(controller));

router.put("/preferences", controller.updatePreferences.bind(controller));

router.patch("/read-all", controller.markAllRead.bind(controller));

router.patch("/:id/read", controller.markRead.bind(controller));

export default router;
