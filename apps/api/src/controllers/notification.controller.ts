import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { NotificationType } from "@prisma/client";
import {
  handleError,
  handleNotFoundError,
  handleValidationError,
} from "../utils/errorHandler.js";

export class NotificationController {
  async getNotifications(req: Request, res: Response) {
    const operation = "Get notifications";
    try {
      const userId = req.user!.id;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = 20;
      const skip = (page - 1) * limit;

      const [notifications, totalItems, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.notification.count({ where: { userId } }),
        prisma.notification.count({ where: { userId, isRead: false } }),
      ]);

      res.json({
        data: notifications,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages: Math.ceil(totalItems / limit),
        },
        unreadCount,
      });
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  async markRead(req: Request, res: Response) {
    const operation = "Mark notification read";
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        handleValidationError(res, "Invalid notification id", "id", operation);
        return;
      }

      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });
      if (!notification) {
        handleNotFoundError(res, "Notification", operation);
        return;
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true, readAt: new Date() },
      });

      res.json({ data: updated });
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  async markAllRead(req: Request, res: Response) {
    const operation = "Mark all notifications read";
    try {
      const userId = req.user!.id;
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      handleError(error, res, operation);
    }
  }
}

/** Helper used by other controllers to push a notification to a user. */
export async function createNotification(params: {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  return prisma.notification.create({ data: params });
}
