"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { Tag } from "@repo/ui/components/ui/tag";
import { roleTone } from "@repo/ui/components/ui/status-badge";

export default function UnauthorizedPage() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md w-full space-y-4 p-8 bg-surface rounded-lg shadow-lg">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-error-surface">
            <svg
              className="h-10 w-10 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-base sm:text-lg mt-4 font-extrabold text-foreground">
            Access Denied
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            You don't have permission to access this page.
          </p>
          {user && (
            <p className="mt-4 text-sm text-muted-foreground">
              Your current role:{" "}
              <Tag tone={roleTone(user.role)}>{user.role}</Tag>
            </p>
          )}
        </div>
        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full flex justify-center py-2 px-4 border border-input rounded-md shadow-sm text-sm font-medium text-text-secondary bg-surface hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring whitespace-nowrap"
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring whitespace-nowrap"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
