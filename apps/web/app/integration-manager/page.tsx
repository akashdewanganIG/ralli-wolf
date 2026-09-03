"use client";

import React from "react";
import { RoleGuard } from "@/components/guards/role-guard";
import { IntegrationManagerForm } from "./integration-manager-form";

export default function IntegrationManagerPage() {
  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
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
        </div>
        <IntegrationManagerForm />
      </div>
    </RoleGuard>
  );
}
