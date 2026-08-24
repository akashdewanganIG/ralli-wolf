import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { NotificationType } from "@prisma/client";
import {
  handleError,
  handleNotFoundError,
  handleValidationError,
} from "../utils/errorHandler.js";
import {
  CONFIGURABLE_TYPES,
  NOTIFICATION_CATALOGUE,
  NOTIFICATION_DEFAULT,
} from "../services/notificationCatalogue.js";
import { buildNotificationEmail } from "../services/notificationEmail.js";
import { emailService } from "../services/email.service.js";

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

  /**
   * The full preference list for the current user.
   *
   * Always returns one entry per catalogue type — merged with whatever the
   * user has saved — so the client renders the same list for a brand-new user
   * as for one who has changed everything, with no client-side defaulting.
   */
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

  /**
   * Saves the preference list.
   *
   * Takes the whole list rather than one row so the screen can save once,
   * and writes them in a transaction so a partial save cannot leave a user
   * with half their choices applied.
   */
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

/**
 * Resolves one user's channels for one notification type.
 *
 * An absent row means the defaults, so a user who has never opened the
 * settings screen still receives everything. Types outside the catalogue are
 * not configurable and always go to the bell menu.
 */
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

/**
 * Whether this user wants email for this type.
 *
 * For callers that already send their own, richer email for the same event —
 * an approval request carries reference numbers and the requester's name that
 * a generic notification body cannot know. They send it themselves and gate it
 * on this, instead of letting `createNotification` send a second, thinner one.
 */
export async function shouldSendEmail(
  userId: number,
  type: NotificationType
): Promise<boolean> {
  const channels = await resolveChannels(userId, type);
  return channels.email;
}

/**
 * Pushes a notification to a user, honouring their preferences.
 *
 * Both channels are gated: turning a notification off in settings stops the
 * bell entry as well as the email, which is what "I do not want this" means.
 * The email is dispatched without being awaited — callers use this
 * fire-and-forget inside request handlers, and a slow mail provider must not
 * hold up the response that triggered it.
 *
 * Returns the created notification, or `null` when the user has switched the
 * in-app channel off.
 */
export async function createNotification(params: {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  /**
   * Set when the caller sends its own email for this event. Suppresses the
   * generic one so the recipient gets a single message, not two describing the
   * same thing. The caller is then responsible for checking `shouldSendEmail`.
   */
  emailHandledByCaller?: boolean;
}) {
  const { emailHandledByCaller, ...data } = params;
  const channels = await resolveChannels(data.userId, data.type);

  if (channels.email && !emailHandledByCaller) {
    void sendNotificationEmail(data).catch(error =>
      console.error("[Notification] Email dispatch failed:", error)
    );
  }

  if (!channels.inApp) return null;
  return prisma.notification.create({ data });
}

/** Renders and sends the email for one notification. Never throws. */
async function sendNotificationEmail(params: {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { email: true, firstName: true, lastName: true },
  });
  if (!user?.email) return;

  const recipientName = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ");

  const { subject, html } = buildNotificationEmail({
    type: params.type,
    recipientName,
    title: params.title,
    message: params.message,
    link: params.link,
  });

  await emailService.sendEmail({
    to: user.email,
    subject,
    body: html,
    name: recipientName || user.email,
  });
}
