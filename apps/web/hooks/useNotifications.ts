"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "@/lib/api/services";

export type AppNotification = {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
  readAt: string | null;
};

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationService.getAll(),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => notificationService.markRead(id),
    onMutate: async id => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const prev = qc.getQueryData<
        Awaited<ReturnType<typeof notificationService.getAll>>
      >(["notifications"]);
      if (prev) {
        qc.setQueryData(["notifications"], {
          ...prev,
          data: prev.data.map(n => (n.id === id ? { ...n, isRead: true } : n)),
          unreadCount: Math.max(0, prev.unreadCount - 1),
        });
      }
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notifications"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const prev = qc.getQueryData<
        Awaited<ReturnType<typeof notificationService.getAll>>
      >(["notifications"]);
      if (prev) {
        qc.setQueryData(["notifications"], {
          ...prev,
          data: prev.data.map(n => ({ ...n, isRead: true })),
          unreadCount: 0,
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notifications"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
