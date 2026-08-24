"use client";

import { Header } from "@repo/ui";
import { Button } from "@repo/ui/components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import { useSystemStatus } from "../hooks/useSystemStatus";
import { SystemStatusDropdown } from "@repo/ui/components/ui/header/system-status-dropdown";
import { useState } from "react";
import { ChangePasswordModal } from "./change-password-modal";
import { NotificationDropdown } from "./notification-dropdown";
import { Menu } from "@repo/ui/icons";
import { ThemeToggle } from "./theme-toggle";
import { CurrencyToggle } from "./currency-toggle";

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
  const [showChangePassword, setShowChangePassword] = useState(false);
  // Hooks must run unconditionally, so this sits above the `user` guard.
  const { groups: statusGroups, summaryLabel } = useSystemStatus();

  if (!user) return null;

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
            </div>
          )
        }
        actionSlot={
          <>
            <CurrencyToggle />
            <SystemStatusDropdown
              groups={statusGroups}
              summaryLabel={summaryLabel}
            />
          </>
        }
        preferences={<ThemeToggle className="flex w-full [&>button]:flex-1" />}
        notificationSlot={
          hideNotifications ? undefined : <NotificationDropdown />
        }
        user={{
          name:
            [user.firstName, user.lastName].filter(Boolean).join(" ") ||
            "Unknown User",
          email: user.email || "No email provided",
          role: user.role || "User",
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
