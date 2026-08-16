"use client";

import * as React from "react";
import { ProfileDropdown, type UserProfile } from "./profile-dropdown";
import { cn } from "@repo/ui/lib/utils";

export interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  icon?: React.ReactNode;
  notificationSlot?: React.ReactNode;
  user?: UserProfile;
  onEditProfile?: () => void;
  onManageNotifications?: () => void;
  onChangePassword?: () => void;
  onLogout?: () => void;
  tabs?: React.ReactNode;
}

export function Header({
  className,
  icon,
  notificationSlot,
  user,
  onEditProfile,
  onManageNotifications,
  onChangePassword,
  onLogout,
  tabs,
  ...props
}: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 mx-auto w-full max-w-screen-3xl border-b border-border bg-surface/95 backdrop-blur",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "flex h-16 w-full max-w-screen-3xl items-center justify-between bg-navbar px-4 sm:px-6 xl:px-8"
        )}
      >
        {/* Left side - Icon */}
        <div className="min-w-0 flex items-center">
          {icon && (
            <div className="flex items-center space-x-2 text-primary">
              {icon}
            </div>
          )}
        </div>

        {/* Center - Tabs */}
        {tabs && <div className="flex-1 flex justify-center">{tabs}</div>}

        {/* Right side - Notifications and Profile */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Notification bell — rendered by the app layer so it can use app hooks */}
          {notificationSlot}

          {/* Profile Dropdown */}
          {user && (
            <ProfileDropdown
              user={user}
              onEditProfile={onEditProfile}
              onManageNotifications={onManageNotifications}
              onChangePassword={onChangePassword}
              onLogout={onLogout}
            />
          )}
        </div>
      </div>
    </header>
  );
}
