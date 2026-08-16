"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import { useSidebar } from "./sidebar-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "../tooltip";
import type { LucideIcon } from "lucide-react";

interface SidebarItemProps {
  icon?: LucideIcon;
  label: string;
  href?: string;
  active?: boolean;
  target?: string;
}

export function SidebarItem({
  icon: Icon,
  label,
  href,
  active,
  target,
}: SidebarItemProps) {
  const { open } = useSidebar();
  const className = cn(
    "flex h-10 min-h-10 items-center rounded-lg text-sm font-medium text-sidebar-foreground outline-none transition-[background-color,color] duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/25",
    // Collapsed rail: centre the icon instead of leaving it hugging the left edge.
    open ? "gap-3 px-3" : "justify-center px-0",
    active &&
      "bg-sidebar-primary text-sidebar-primary-foreground font-semibold hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
  );

  const content = (
    <>
      {Icon && (
        <span className="flex-shrink-0">
          {React.createElement(Icon, { size: 18 })}
        </span>
      )}
      <span
        className={cn(
          "transition-opacity duration-150 ease-in-out whitespace-nowrap",
          !open && "opacity-0 w-0 overflow-hidden"
        )}
      >
        {label}
      </span>
    </>
  );

  const itemContent = href ? (
    <Link
      href={href}
      target={target}
      prefetch={target === "_blank" ? false : true}
      className={className}
    >
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );

  if (!open) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{itemContent}</TooltipTrigger>
          <TooltipContent
            side="right"
            className="bg-black text-white rounded-md px-2 py-1 text-xs border-none"
          >
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return itemContent;
}
