"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle,
  ClipboardCheck,
  FileText,
  Handshake,
  Package,
  PackageCheck,
  Pencil,
  ShoppingCart,
  TrendingUp,
  Users,
  XCircle,
  type IconComponent,
} from "@repo/ui/icons";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type AppNotification,
} from "@/hooks/use-notifications";
import { Skeleton, SkeletonRegion } from "@repo/ui/components/ui/skeleton";
import { Tag } from "@repo/ui/components/ui/tag";

const TYPE_ICONS: Record<string, IconComponent> = {
  LEAD_ASSIGNED: Users,
  LEAD_UPDATED: Pencil,
  APPROVAL_REQUESTED: ClipboardCheck,
  APPROVAL_APPROVED: CheckCircle,
  APPROVAL_REJECTED: XCircle,
  QUOTE_ACCEPTED: Handshake,
  ORDER_CREATED: ShoppingCart,
  STOCK_ALERT: TrendingUp,
  PURCHASE_ORDER_APPROVED: CheckCircle,
  PURCHASE_ORDER_REJECTED: XCircle,
  GOODS_RECEIVED: PackageCheck,
  QC_FAILED: AlertTriangle,
  MATERIAL_SHORTAGE: Package,
  GENERAL: Bell,
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: (id: number, link: string | null) => void;
}) {
  const Icon = TYPE_ICONS[notification.type] ?? Bell;

  return (
    <button
      type="button"
      onClick={() => onRead(notification.id, notification.link)}
      className={`flex w-full items-start gap-3 border-b border-border/80 px-4 py-3 text-left outline-none transition-colors last:border-0 hover:bg-surface-subtle focus-visible:bg-surface-subtle ${
        !notification.isRead ? "bg-accent/60" : ""
      }`}
    >
      <Icon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-snug ${!notification.isRead ? "font-semibold text-foreground" : "font-medium text-text-secondary"}`}
        >
          {notification.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {notification.message}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/75">
          {timeAgo(notification.createdAt)}
        </p>
      </div>
      {!notification.isRead && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  );
}

export function NotificationDropdown() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.data ?? [];

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleKeydown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [open]);

  function handleRead(id: number, link: string | null) {
    markRead.mutate(id);
    if (link) {
      setOpen(false);
      router.push(link);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground outline-none transition-[background-color,border-color,color] duration-150 hover:border-border-strong hover:bg-surface-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="notification-panel"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-destructive text-[0.625rem] font-semibold leading-none text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notification-panel"
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-4 top-[4.25rem] z-50 w-auto overflow-hidden rounded-xl border border-border bg-surface shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-80"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">
              Notifications
              {unreadCount > 0 && (
                <Tag tone="neutral" className="ml-2 tabular-nums">
                  {unreadCount}
                </Tag>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="flex items-center gap-1 text-xs font-medium text-primary outline-none hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
              >
                <CheckCheck aria-hidden="true" className="size-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[min(26rem,70svh)] overflow-y-auto">
            {isLoading ? (
              <SkeletonRegion label="Loading notifications" className="p-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex gap-2.5 px-2 py-2.5">
                    <Skeleton className="size-4 shrink-0 rounded" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                  </div>
                ))}
              </SkeletonRegion>
            ) : isError ? (
              <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
                <AlertTriangle
                  aria-hidden="true"
                  className="size-5 text-muted-foreground/60"
                />
                <p className="text-sm font-medium text-foreground">
                  Could not load notifications
                </p>
                <p className="text-xs text-muted-foreground">
                  Check your connection and reopen this menu.
                </p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
                <Bell
                  aria-hidden="true"
                  className="size-5 text-muted-foreground/60"
                />
                <p className="text-sm font-medium text-foreground">
                  You are all caught up
                </p>
                <p className="text-xs text-muted-foreground">
                  Approvals, quality checks, and stock alerts will appear here.
                </p>
              </div>
            ) : (
              notifications.map(n => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={handleRead}
                />
              ))
            )}
          </div>

          <div className="border-t border-border px-4 py-2.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/admin/notifications");
              }}
              className="text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              Notification settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
