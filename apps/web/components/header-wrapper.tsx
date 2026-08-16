"use client";

import { Header } from "@repo/ui";
import { Button } from "@repo/ui/components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import { useHealth } from "../hooks/useWebhook";
import { Badge } from "@repo/ui/components/ui/badge";
import { useState } from "react";
import { ChangePasswordModal } from "./change-password-modal";
import { NotificationDropdown } from "./notification-dropdown";
import { Menu } from "lucide-react";

interface HeaderWrapperProps {
  icon?: React.ReactNode;
  hideNotifications?: boolean;
  className?: string;
  onMenuClick?: () => void;
}

export function HeaderWrapper({
  icon,
  hideNotifications = false,
  className,
  onMenuClick,
}: HeaderWrapperProps) {
  const { user, logout } = useAuth();
  const { data: health, isLoading: healthLoading } = useHealth();
  const [showChangePassword, setShowChangePassword] = useState(false);

  if (!user) return null;

  const getHealthStatus = () => {
    if (healthLoading)
      return { text: "Loading...", variant: "secondary" as const };
    if (!health) return { text: "Offline", variant: "destructive" as const };
    if (health.status === "ok" && health.database === "connected") {
      return { text: "Online", variant: "success" as const };
    }
    return { text: "Issues", variant: "destructive" as const };
  };

  const healthStatus = getHealthStatus();

  return (
    <>
      <Header
        className={className}
        icon={
          icon ?? (
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onMenuClick}
                aria-label="Open navigation"
                className="text-muted-foreground hover:text-foreground lg:hidden"
              >
                <Menu className="size-5" />
              </Button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                  Ralli Wolf Operations
                </p>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  Inventory, production and supply chain
                </p>
              </div>
              <Badge
                variant={healthStatus.variant}
                className="hidden sm:inline-flex"
              >
                {healthStatus.text}
              </Badge>
            </div>
          )
        }
        notificationSlot={
          hideNotifications ? undefined : <NotificationDropdown />
        }
        user={{
          name:
            [user.firstName, user.lastName].filter(Boolean).join(" ") ||
            "Unknown User",
          email: user.email || "No email provided",
          role: user.role || "User",
          isOnline: true,
        }}
        onLogout={logout}
        onChangePassword={() => setShowChangePassword(true)}
      />
      <ChangePasswordModal
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </>
  );
}
