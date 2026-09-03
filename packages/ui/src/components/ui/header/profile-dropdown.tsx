"use client";

import * as React from "react";
import { User, Bell, LogOut, KeyRound } from "@repo/ui/icons";
import { Avatar, AvatarFallback, AvatarImage } from "../avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { Tag } from "@repo/ui/components/ui/tag";
import { roleTone } from "@repo/ui/components/ui/status-badge";
import { MENU_ITEM_DESTRUCTIVE } from "@repo/ui/components/ui/form-control";

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

export interface ProfileDropdownProps {
  user: UserProfile;
  onEditProfile?: () => void;
  onManageNotifications?: () => void;
  onChangePassword?: () => void;
  onLogout?: () => void;

  preferences?: React.ReactNode;
  className?: string;
}

export function ProfileDropdown({
  user,
  onEditProfile,
  onManageNotifications,
  onChangePassword,
  onLogout,
  preferences,
  className,
}: ProfileDropdownProps) {
  const initials =
    user.name
      .split(" ")
      .map(part => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  const hasActions = Boolean(
    onEditProfile || onManageNotifications || onChangePassword
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface outline-none transition-[background-color,border-color] duration-150 hover:border-border-strong hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring/30",
            className
          )}
          aria-label={`Open account menu for ${user.name}`}
        >
          <Avatar className="size-7 rounded-sm">
            <AvatarImage src={user.avatar} alt="" />
            <AvatarFallback className="bg-primary text-[0.6875rem] font-semibold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[min(15rem,calc(100vw-2rem))] p-1"
        align="end"
        sideOffset={6}
      >
        <div className="px-2 py-1.5">
          <p className="truncate text-[0.8125rem] font-semibold leading-5 text-foreground">
            {user.name}
          </p>
          <p
            className="truncate text-xs leading-4 text-muted-foreground"
            title={user.email}
          >
            {user.email}
          </p>
          <Tag tone={roleTone(user.role)} className="mt-1">
            {user.role}
          </Tag>
        </div>

        {hasActions ? <DropdownMenuSeparator /> : null}

        {onEditProfile && (
          <DropdownMenuItem onClick={onEditProfile}>
            <User aria-hidden="true" className="size-4" />
            <span>Profile</span>
          </DropdownMenuItem>
        )}
        {onManageNotifications && (
          <DropdownMenuItem onClick={onManageNotifications}>
            <Bell aria-hidden="true" className="size-4" />
            <span>Notifications</span>
          </DropdownMenuItem>
        )}
        {onChangePassword && (
          <DropdownMenuItem onClick={onChangePassword}>
            <KeyRound aria-hidden="true" className="size-4" />
            <span>Change password</span>
          </DropdownMenuItem>
        )}

        {preferences ? (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Appearance
              </p>
              {preferences}
            </div>
          </>
        ) : null}

        {onLogout ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onLogout}
              className={MENU_ITEM_DESTRUCTIVE}
            >
              <LogOut aria-hidden="true" className="size-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
