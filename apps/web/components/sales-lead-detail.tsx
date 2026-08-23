"use client";

import { toast } from "@/lib/toast";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Textarea } from "@repo/ui/components/ui/textarea";
import {
  ArrowLeft,
  Building2,
  CheckCircle,
  Phone,
  XCircle,
} from "@repo/ui/icons";
import Image from "next/image";
import { useState } from "react";
import logo from "../app/assets/images/logos/logo_v1.png";
import { Lead } from "../lib/api/types";
import { getLeadFullName } from "../lib/name";
import { displayPhone } from "../lib/phone-formatter";
import { HeaderWrapper } from "./header-wrapper";

interface SalesLeadDetailProps {
  lead: Lead;
  onBack: () => void;
  onStatusUpdate?: (
    leadId: number,
    status: string,
    remark: string
  ) => Promise<void>;
}

export function SalesLeadDetail({
  lead,
  onBack,
  onStatusUpdate,
}: SalesLeadDetailProps) {
  const [remark, setRemark] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const handleQualified = async () => {
    if (!onStatusUpdate) {
      toast.error("Status update functionality not available");
      return;
    }

    if (!remark.trim()) {
      toast.error("Please add a remark before marking as qualified");
      return;
    }

    setIsLoading(true);
    try {
      await onStatusUpdate(lead.id, "Qualified", remark);
      toast.success("Lead marked as qualified successfully!");
      setSelectedStatus("Qualified");
    } catch {
      toast.error("Failed to update lead status");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnqualified = async () => {
    if (!onStatusUpdate) {
      toast.error("Status update functionality not available");
      return;
    }

    if (!remark.trim()) {
      toast.error("Please add a remark before marking as unqualified");
      return;
    }

    setIsLoading(true);
    try {
      await onStatusUpdate(lead.id, "Closed Lost", remark);
      toast.success("Lead marked as unqualified");
      setSelectedStatus("Unqualified");
    } catch {
      toast.error("Failed to update lead status");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <HeaderWrapper
        icon={
          <Image
            src={logo}
            alt="Company Logo"
            width={120}
            height={40}
            className="object-contain"
          />
        }
        hideNotifications={true}
      />

      {/* Content */}
      <div className="container mx-auto p-4 md:p-4 max-w-2xl">
        {/* Back Button */}
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Leads
        </Button>

        {/* Lead Details Card */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Lead Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground">
                    {getLeadFullName(lead.firstName, lead.lastName)}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    {lead.companyName || "No company"}
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                {lead.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">
                      {displayPhone(lead.phone, lead.countryCode)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions Card */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Lead Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button
                className="flex-1 h-auto py-12"
                variant="default"
                onClick={handleQualified}
                disabled={isLoading || selectedStatus === "Qualified"}
              >
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle className="h-6 w-6" />
                  <span className="text-lg">Qualified</span>
                </div>
              </Button>

              <Button
                className="flex-1 h-auto py-12"
                variant="destructive"
                onClick={handleUnqualified}
                disabled={isLoading || selectedStatus === "Unqualified"}
              >
                <div className="flex flex-col items-center gap-2">
                  <XCircle className="h-6 w-6" />
                  <span className="text-lg">Unqualified</span>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Remarks Card */}
        <Card>
          <CardHeader>
            <CardTitle>Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Enter your remarks about this lead..."
              value={remark}
              onChange={e => setRemark(e.target.value)}
              className="min-h-[7.5rem]"
              disabled={isLoading || !!selectedStatus}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Add remarks to document your interaction with this lead
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
