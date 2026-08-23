"use client";

import React from "react";
import { DeveloperGuard } from "@/components/guards/DeveloperGuard";
import { IntegrationManagerForm } from "./IntegrationManagerForm";
import { Button } from "@repo/ui/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function IntegrationManagerPage() {
  const { logout } = useAuth();

  return (
    <DeveloperGuard>
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-base sm:text-lg font-semibold">
              Integration Manager
            </h1>
            <p className="text-sm text-muted-foreground">
              Store and manage encrypted API keys for WhatsApp and Email
              providers.
            </p>
          </div>
          <Button
            variant="secondary"
            className="bg-destructive text-destructive-foreground hover:bg-destructive"
            onClick={() => void logout()}
          >
            Logout
          </Button>
        </div>
        <IntegrationManagerForm />
      </div>
    </DeveloperGuard>
  );
}
