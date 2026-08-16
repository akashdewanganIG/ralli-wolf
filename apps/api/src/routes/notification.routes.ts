import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { NotificationController } from "../controllers/notification.controller.js";

const router = Router();
const controller = new NotificationController();

router.use(requireAuth);

// GET  /api/notifications        — paginated list + unread count for current user
router.get("/", controller.getNotifications.bind(controller));

// PATCH /api/notifications/read-all — mark every unread as read (must be before /:id)
router.patch("/read-all", controller.markAllRead.bind(controller));

// PATCH /api/notifications/:id/read — mark a single notification as read
router.patch("/:id/read", controller.markRead.bind(controller));

export default router;
