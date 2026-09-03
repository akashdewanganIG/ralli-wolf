import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { NotificationType, Prisma } from "@prisma/client";
import {
  handleError,
  handleNotFoundError,
  handleValidationError,
} from "../utils/error-handler.js";
import {
  CONFIGURABLE_TYPES,
  NOTIFICATION_CATALOGUE,
  NOTIFICATION_DEFAULT,
} from "../services/notification-catalogue.js";
import { buildNotificationEmail } from "../services/notification-email.js";
import { emailService } from "../services/email.service.js";
import { logError } from "../utils/logger.js";
import {
  parseBoundedInteger,
  parsePositiveInteger,
} from "../utils/validators.js";

const NOTIFICATION_PUBLIC_SELECT = {
  id: true,
  type: true,
  title: true,
  message: true,
  isRead: true,
  link: true,
  createdAt: true,
  readAt: true,
} satisfies Prisma.NotificationSelect;

export class NotificationController {
  async getNotifications(req: Request, res: Response) {
    const operation = "Get notifications";
    try {
      const userId = req.user!.id;
      const page =
        req.query.page === undefined
          ? 1
          : parseBoundedInteger(req.query.page, 1, 1_000_000);
      if (page === null) {
        return handleValidationError(
          res,
          "page must be a positive integer",
          "page",
          operation
        );
      }
      const limit = 20;
      const skip = (page - 1) * limit;

      const [notifications, totalItems, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where: { userId },
          select: NOTIFICATION_PUBLIC_SELECT,
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
      const id = parsePositiveInteger(req.params.id);
      if (id === null) {
        handleValidationError(res, "Invalid notification id", "id", operation);
        return;
      }

      const notification = await prisma.notification.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!notification) {
        handleNotFoundError(res, "Notification", operation);
        return;
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true, readAt: new Date() },
        select: NOTIFICATION_PUBLIC_SELECT,
      });

      res.json({ data: updated });
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  async getPreferences(req: Request, res: Response) {
    const operation = "Get notification preferences";
    try {
      const userId = req.user!.id;
      const saved = await prisma.notificationPreference.findMany({
        where: { userId },
        select: { type: true, inApp: true, email: true },
      });
      const byType = new Map(saved.map(row => [row.type, row]));

      res.json({
        data: NOTIFICATION_CATALOGUE.map(entry => {
          const row = byType.get(entry.type);
          return {
            type: entry.type,
            label: entry.label,
            description: entry.description,
            group: entry.group,
            supportsEmail: entry.supportsEmail,
            inApp: row ? row.inApp : NOTIFICATION_DEFAULT.inApp,
            email: row ? row.email : NOTIFICATION_DEFAULT.email,
          };
        }),
      });
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  async updatePreferences(req: Request, res: Response) {
    const operation = "Update notification preferences";
    try {
      const userId = req.user!.id;
      const input = req.body?.preferences;

      if (!Array.isArray(input)) {
        handleValidationError(
          res,
          "preferences must be an array",
          "preferences",
          operation
        );
        return;
      }

      const updates: {
        type: NotificationType;
        inApp: boolean;
        email: boolean;
      }[] = [];

      for (const row of input) {
        const type = row?.type as NotificationType;
        if (!type || !CONFIGURABLE_TYPES.has(type)) {
          handleValidationError(
            res,
            `Unknown notification type: ${String(row?.type)}`,
            "type",
            operation
          );
          return;
        }
        if (typeof row.inApp !== "boolean" || typeof row.email !== "boolean") {
          handleValidationError(
            res,
            `inApp and email must be booleans for ${type}`,
            "preferences",
            operation
          );
          return;
        }
        updates.push({ type, inApp: row.inApp, email: row.email });
      }

      await prisma.$transaction(
        updates.map(row =>
          prisma.notificationPreference.upsert({
            where: { userId_type: { userId, type: row.type } },
            create: {
              userId,
              type: row.type,
              inApp: row.inApp,
              email: row.email,
            },
            update: { inApp: row.inApp, email: row.email },
          })
        )
      );

      res.json({ message: "Notification preferences saved" });
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

export async function resolveChannels(
  userId: number,
  type: NotificationType
): Promise<{ inApp: boolean; email: boolean }> {
  if (!CONFIGURABLE_TYPES.has(type)) {
    return { inApp: true, email: false };
  }
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId_type: { userId, type } },
    select: { inApp: true, email: true },
  });
  return preference ?? { ...NOTIFICATION_DEFAULT };
}

export async function shouldSendEmail(
  userId: number,
  type: NotificationType
): Promise<boolean> {
  const channels = await resolveChannels(userId, type);
  return channels.email;
}

export async function createNotification(params: {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;

  emailHandledByCaller?: boolean;

  dedupeKey?: string;

  awaitEmailDelivery?: boolean;
}) {
  const { emailHandledByCaller, awaitEmailDelivery = false, ...data } = params;
  if (data.dedupeKey && data.dedupeKey.length > 200) {
    throw new Error("Notification dedupe key cannot exceed 200 characters");
  }
  const channels = await resolveChannels(data.userId, data.type);

  let notification = null;
  if (channels.inApp) {
    try {
      notification = await prisma.notification.create({ data });
    } catch (error) {
      if (
        data.dedupeKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        notification = await prisma.notification.findUnique({
          where: { dedupeKey: data.dedupeKey },
        });
      } else {
        throw error;
      }
    }
  }

  if (channels.email && !emailHandledByCaller) {
    const delivery = sendNotificationEmail(data);
    if (awaitEmailDelivery) {
      const accepted = await delivery;
      if (!accepted) {
        throw new Error("Notification email provider did not accept delivery");
      }
    } else {
      void delivery.catch(error =>
        logError("notification_email_dispatch_failed", error, {
          userId: data.userId,
          type: data.type,
        })
      );
    }
  }

  return notification;
}

async function sendNotificationEmail(params: {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  dedupeKey?: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { email: true, firstName: true, lastName: true },
  });
  if (!user?.email) return true;

  const recipientName = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ");

  const { subject, html } = buildNotificationEmail({
    type: params.type,
    recipientName,
    title: params.title,
    message: params.message,
  });

  return emailService.sendEmail({
    to: user.email,
    subject,
    body: html,
    name: recipientName || user.email,
    idempotencyKey: params.dedupeKey,
  });
}
