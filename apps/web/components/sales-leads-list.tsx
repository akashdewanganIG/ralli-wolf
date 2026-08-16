"use client";

import React from "react";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Building2, Phone, User } from "lucide-react";
import { Lead } from "../lib/api/types";
import { getLeadFullName } from "../lib/name";
import { ListSkeleton } from "./skeletons";
import { displayPhone } from "../lib/phone-formatter";

interface SalesLeadsListProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  isLoading?: boolean;
}

export function SalesLeadsList({
  leads,
  onLeadClick,
  isLoading,
}: SalesLeadsListProps) {
  // Ensure leads is always an array
  const safeLeads = Array.isArray(leads) ? leads : [];

  if (isLoading) {
    return <ListSkeleton rows={4} />;
  }

  if (safeLeads.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
          <User className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No assigned leads
        </h3>
        <p className="text-sm text-gray-500">
          You don't have any leads assigned to you yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {safeLeads.map(lead => (
        <Card
          key={lead.id}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onLeadClick(lead)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">
                  {getLeadFullName(lead.firstName, lead.lastName)}
                </h3>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Building2 className="h-3 w-3" />
                  <span>{lead.companyName || "No company"}</span>
                </div>
              </div>

              {lead.phone && (
                <div className="flex items-center gap-1 text-sm text-gray-600 ml-4">
                  <Phone className="h-4 w-4" />
                  <span>{displayPhone(lead.phone, lead.countryCode)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
