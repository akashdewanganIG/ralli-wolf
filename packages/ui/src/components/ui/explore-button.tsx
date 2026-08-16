"use client";

import React from "react";
import { cn } from "@repo/ui/lib/utils";
import styles from "./explore-button.module.css";

interface ExploreButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}

export const ExploreButton = React.forwardRef<
  HTMLButtonElement,
  ExploreButtonProps
>(({ children, className, showIcon = true, ...props }, ref) => {
  return (
    <button
      ref={ref}
      type={props.type || "button"}
      className={cn(styles.exploreBtn, "group", className)}
      {...props}
    >
      {children}
      {showIcon && (
        <svg
          className="w-6 h-6 justify-end ease-linear duration-300 rounded-full border border-gray-700 p-1.5 rotate-45 group-hover:rotate-90 group-hover:bg-gray-50 group-hover:border-none"
          viewBox="0 0 16 19"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7 18C7 18.5523 7.44772 19 8 19C8.55228 19 9 18.5523 9 18H7ZM8.70711 0.292893C8.31658 -0.0976311 7.68342 -0.0976311 7.29289 0.292893L0.928932 6.65685C0.538408 7.04738 0.538408 7.68054 0.928932 8.07107C1.31946 8.46159 1.95262 8.46159 2.34315 8.07107L8 2.41421L13.6569 8.07107C14.0474 8.46159 14.6805 8.46159 15.0711 8.07107C15.4616 7.68054 15.4616 7.04738 15.0711 6.65685L8.70711 0.292893ZM9 18L9 1H7L7 18H9Z"
            className="fill-gray-800 group-hover:fill-gray-800"
          />
        </svg>
      )}
    </button>
  );
});

ExploreButton.displayName = "ExploreButton";
