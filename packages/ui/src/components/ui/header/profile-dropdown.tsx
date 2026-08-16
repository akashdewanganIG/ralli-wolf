"use client";

import * as React from "react";
import { User, Bell, LogOut, Circle, KeyRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { Button } from "../button";
import { cn } from "@repo/ui/lib/utils";

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  avatar?: string;
  isOnline?: boolean;
}

export interface ProfileDropdownProps {
  user: UserProfile;
  onEditProfile?: () => void;
  onManageNotifications?: () => void;
  onChangePassword?: () => void;
  onLogout?: () => void;
  className?: string;
}

export function ProfileDropdown({
  user,
  onEditProfile,
  onManageNotifications,
  onChangePassword,
  onLogout,
  className,
}: ProfileDropdownProps) {
  const initials = user.name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative rounded-full", className)}
          aria-label={`Open account menu for ${user.name}`}
        >
          <Avatar className="size-9">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {user.isOnline && (
            <div className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-background bg-success" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[min(18rem,calc(100vw-2rem))]"
        align="end"
        forceMount
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <Avatar className="size-11">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="text-lg bg-primary text-primary-foreground font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {user.role}
                </p>
                <div className="mt-1 flex items-center">
                  <Circle
                    className={cn(
                      "mr-1 size-2",
                      user.isOnline
                        ? "fill-success text-success"
                        : "fill-muted-foreground text-muted-foreground"
                    )}
                  />
                  <span className="text-xs text-muted-foreground">
                    {user.isOnline ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
            </div>
            <p
              className="mt-2 truncate text-xs text-muted-foreground"
              title={user.email}
            >
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        {(onEditProfile || onManageNotifications) && <DropdownMenuSeparator />}
        {onEditProfile && (
          <DropdownMenuItem onClick={onEditProfile} className="cursor-pointer">
            <User className="size-4" />
            <span>Edit Profile</span>
          </DropdownMenuItem>
        )}
        {onManageNotifications && (
          <DropdownMenuItem
            onClick={onManageNotifications}
            className="cursor-pointer"
          >
            <Bell className="size-4" />
            <span>Manage Notifications</span>
          </DropdownMenuItem>
        )}
        {onChangePassword && (
          <DropdownMenuItem
            onClick={onChangePassword}
            className="cursor-pointer"
          >
            <KeyRound className="size-4" />
            <span>Change Password</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onLogout}
          className="cursor-pointer text-error-foreground focus:bg-error-surface focus:text-error-foreground"
        >
          <LogOut className="size-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
