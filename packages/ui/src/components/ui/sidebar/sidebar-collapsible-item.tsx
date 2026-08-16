"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@repo/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { useSidebar } from "./sidebar-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "../tooltip";
import type { LucideIcon } from "lucide-react";

interface SidebarCollapsibleItemProps {
  icon?: LucideIcon;
  label: string;
  children: React.ReactNode;
  active?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

export function SidebarCollapsibleItem({
  icon: Icon,
  label,
  children,
  active = false,
  defaultOpen = false,
  className,
}: SidebarCollapsibleItemProps) {
  const { open: sidebarOpen } = useSidebar();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Update open state when defaultOpen changes
  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  // Auto-collapse children when sidebar is collapsed
  useEffect(() => {
    if (!sidebarOpen) {
      setIsOpen(false);
    }
  }, [sidebarOpen]);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  const buttonContent = (
    <button
      type="button"
      onClick={toggleOpen}
      className={cn(
        "flex h-10 min-h-10 w-full items-center gap-3 rounded-lg text-sm font-medium text-sidebar-foreground outline-none transition-[background-color,color] duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/25",
        // Collapsed rail: centre the icon instead of leaving it hugging the left edge.
        sidebarOpen ? "justify-between px-3" : "justify-center px-0",
        active &&
          "bg-sidebar-primary text-sidebar-primary-foreground font-semibold hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
      )}
      aria-expanded={isOpen}
      aria-label={`${isOpen ? "Collapse" : "Expand"} ${label}`}
    >
      <div className={cn("flex items-center", sidebarOpen && "gap-3")}>
        {Icon && (
          <span className="flex-shrink-0">
            {React.createElement(Icon, { size: 18 })}
          </span>
        )}
        <span
          className={cn(
            "transition-opacity duration-150 ease-in-out whitespace-nowrap",
            !sidebarOpen && "opacity-0 w-0 overflow-hidden"
          )}
        >
          {label}
        </span>
      </div>
      {sidebarOpen && (
        <ChevronDown
          size={16}
          className={cn(
            "transition-transform duration-300 ease-in-out",
            isOpen && "rotate-180"
          )}
        />
      )}
    </button>
  );

  return (
    <div className={cn("", className)}>
      {/* Parent Item */}
      {!sidebarOpen ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
            <TooltipContent
              side="right"
              className="bg-black text-white rounded-md px-2 py-1 text-xs border-none"
            >
              {label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        buttonContent
      )}

      {/* Children Container with Smooth Animation */}
      {sidebarOpen && (
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
            isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-1 pl-6 pt-1">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}
