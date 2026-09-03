"use client";

import { RoleGuard } from "@/components/guards/role-guard";
import { TablePageSkeleton } from "@/components/skeletons";
import { salesService } from "@/lib/api/services";
import { Enquiry, Lead } from "@/lib/api/types";
import { getLeadFullName } from "@/lib/name";
import { Badge, Button, Input, Label } from "@repo/ui";
import { Alert } from "@repo/ui/components/ui/alert";
import { useEffect, useState } from "react";
import { Tag } from "@repo/ui/components/ui/tag";
import { PageShell } from "@repo/ui/components/ui/page-shell";

interface LeadWithRemarks extends Lead {
  remarks?: Array<{
    id: number;
    remark: string;
    createdAt: string;
    user: {
      firstName: string | null;
      lastName: string | null;
      email: string;
    };
  }>;
  enquiries?: Enquiry[];
}

export default function SalesPage() {
  const [leads, setLeads] = useState<LeadWithRemarks[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadWithRemarks | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState("");
  const [submittingRemark, setSubmittingRemark] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchLeadsAndStats();
  }, []);

  const fetchLeadsAndStats = async () => {
    try {
      setLoading(true);
      const { leads } = await salesService.getMyLeads({ page: 1, limit: 100 });
      setLeads(leads as LeadWithRemarks[]);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleViewLead = async (lead: LeadWithRemarks) => {
    try {
      const fullLead = await salesService.getLeadById(lead.id);
      setSelectedLead(fullLead as LeadWithRemarks);
    } catch {
      setError("Failed to load lead details");
    }
  };

  const handleQualify = async () => {
    if (!selectedLead) return;
    try {
      setActionLoading(true);
      await salesService.qualifyLead(selectedLead.id);

      setLeads(prev =>
        prev.map(l =>
          l.id === selectedLead.id ? { ...l, status: "QUALIFIED" } : l
        )
      );

      setSelectedLead(prev => (prev ? { ...prev, status: "QUALIFIED" } : null));
    } catch {
      setError("Failed to qualify lead");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisqualify = async () => {
    if (!selectedLead) return;
    try {
      setActionLoading(true);
      await salesService.disqualifyLead(selectedLead.id);

      setLeads(prev =>
        prev.map(l =>
          l.id === selectedLead.id ? { ...l, status: "UNQUALIFIED" } : l
        )
      );

      setSelectedLead(prev =>
        prev ? { ...prev, status: "UNQUALIFIED" } : null
      );
    } catch {
      setError("Failed to disqualify lead");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddRemark = async () => {
    if (!selectedLead || !remarkText.trim()) return;
    try {
      setSubmittingRemark(true);
      const result = await salesService.addRemark(selectedLead.id, remarkText);

      setSelectedLead(prev => {
        if (!prev) return null;
        return {
          ...prev,
          remarks: [result.remark, ...(prev.remarks || [])],
        };
      });

      setRemarkText("");
    } catch {
      setError("Failed to add remark");
    } finally {
      setSubmittingRemark(false);
    }
  };

  const handleResolveEnquiry = async (enquiryId: number) => {
    if (!selectedLead) return;
    try {
      setActionLoading(true);
      await salesService.resolveEnquiry(enquiryId);

      setSelectedLead(prev => {
        if (!prev) return null;
        return {
          ...prev,
          enquiries:
            prev.enquiries?.map(enq =>
              enq.id === enquiryId
                ? {
                    ...enq,
                    status: "RESOLVED" as const,
                    resolvedAt: new Date().toISOString(),
                  }
                : enq
            ) || [],
        };
      });

      await fetchLeadsAndStats();
    } catch {
      setError("Failed to resolve enquiry");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <RoleGuard allowedRoles={["SALES"]}>
        <TablePageSkeleton filters={2} rows={7} />
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={["SALES"]}>
      <div>
        <PageShell>
          {error && (
            <Alert
              className="mb-4"
              tone="error"
              title="Unable to load sales data"
              action={
                <Button variant="outline" onClick={() => setError(null)}>
                  Dismiss
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {selectedLead ? (
            <div>
              <Button
                variant="outline"
                onClick={() => setSelectedLead(null)}
                className="mb-4"
              >
                ← Back to Leads
              </Button>

              <div className="bg-surface rounded-lg shadow-lg p-4 space-y-4">
                <div>
                  <h1 className="text-base sm:text-lg font-semibold mb-4">
                    {getLeadFullName(
                      selectedLead.firstName,
                      selectedLead.lastName
                    )}
                  </h1>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-text-secondary">
                        Email
                      </Label>
                      {selectedLead.email ? (
                        <a
                          href={`mailto:${selectedLead.email}`}
                          className="font-medium text-info-foreground hover:text-info"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {selectedLead.email}
                        </a>
                      ) : (
                        <p className="font-medium">-</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm text-text-secondary">
                        Phone
                      </Label>
                      {selectedLead.phone ? (
                        <a
                          href={`tel:${selectedLead.phone}`}
                          className="font-medium text-info-foreground hover:text-info"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {selectedLead.phone}
                        </a>
                      ) : (
                        <p className="font-medium">-</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm text-text-secondary">
                        Company
                      </Label>
                      <p className="font-medium">
                        {selectedLead.companyName || "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-text-secondary">
                        Status
                      </Label>
                      <Tag
                        tone={
                          selectedLead.status === "QUALIFIED"
                            ? "active"
                            : selectedLead.status === "UNQUALIFIED"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {selectedLead.status || "OPEN"}
                      </Tag>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 border-t pt-4">
                  <Button
                    onClick={handleQualify}
                    disabled={
                      actionLoading || selectedLead.status === "QUALIFIED"
                    }
                    className="bg-success hover:bg-success"
                  >
                    {selectedLead.status === "QUALIFIED"
                      ? "✓ Qualified"
                      : "Qualify Lead"}
                  </Button>
                  <Button
                    onClick={handleDisqualify}
                    disabled={
                      actionLoading || selectedLead.status === "UNQUALIFIED"
                    }
                    variant="destructive"
                  >
                    {selectedLead.status === "UNQUALIFIED"
                      ? "✓ Disqualified"
                      : "Disqualify Lead"}
                  </Button>
                </div>

                {selectedLead.enquiries &&
                  selectedLead.enquiries.length > 0 && (
                    <div className="border-t pt-4">
                      <Label className="text-sm font-semibold mb-3 block">
                        Enquiries
                      </Label>
                      <div className="space-y-3">
                        {selectedLead.enquiries
                          .sort(
                            (a, b) =>
                              new Date(b.enquiryCreatedAt).getTime() -
                              new Date(a.enquiryCreatedAt).getTime()
                          )
                          .map(enquiry => (
                            <div
                              key={enquiry.id}
                              className={`p-4 rounded-lg border ${
                                enquiry.status === "UNRESOLVED"
                                  ? "bg-primary-surface border-warning-border"
                                  : "bg-surface-elevated border-border"
                              }`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(
                                        enquiry.enquiryCreatedAt
                                      ).toLocaleString()}
                                    </span>
                                    <Badge
                                      variant={
                                        enquiry.status === "UNRESOLVED"
                                          ? "default"
                                          : enquiry.status === "RESOLVED"
                                            ? "outline"
                                            : "secondary"
                                      }
                                    >
                                      {enquiry.status}
                                    </Badge>
                                  </div>
                                  {enquiry.landingPageCampaign && (
                                    <p className="text-sm font-medium text-text-secondary">
                                      Campaign:{" "}
                                      {enquiry.landingPageCampaign.name}
                                    </p>
                                  )}
                                </div>
                                {enquiry.status === "UNRESOLVED" && (
                                  <Button
                                    onClick={() =>
                                      handleResolveEnquiry(enquiry.id)
                                    }
                                    disabled={actionLoading}
                                    className="bg-success hover:bg-success"
                                  >
                                    Resolve
                                  </Button>
                                )}
                              </div>

                              {enquiry.customFields &&
                                Object.keys(enquiry.customFields).length >
                                  0 && (
                                  <div className="mt-2 pt-2 border-t border-border">
                                    <p className="text-xs font-semibold text-text-secondary mb-1">
                                      Form Details:
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {Object.entries(enquiry.customFields).map(
                                        ([key, value]) => (
                                          <div key={key} className="text-sm">
                                            <span className="text-text-secondary capitalize">
                                              {key.replace(/_/g, " ")}:
                                            </span>{" "}
                                            <span className="font-medium text-foreground">
                                              {typeof value === "object"
                                                ? JSON.stringify(value)
                                                : String(value)}
                                            </span>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold mb-2 block">
                    Add Remark
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={remarkText}
                      onChange={e => setRemarkText(e.target.value)}
                      placeholder="Enter your remark..."
                      className="flex-1"
                      disabled={submittingRemark}
                    />
                    <Button
                      onClick={handleAddRemark}
                      disabled={submittingRemark || !remarkText.trim()}
                    >
                      {submittingRemark ? "Adding..." : "Add"}
                    </Button>
                  </div>
                </div>

                {selectedLead.remarks && selectedLead.remarks.length > 0 && (
                  <div className="border-t pt-4">
                    <Label className="text-sm font-semibold mb-3 block">
                      Remarks History
                    </Label>
                    <div className="space-y-3">
                      {selectedLead.remarks.map(remark => (
                        <div
                          key={remark.id}
                          className="bg-surface-elevated p-3 rounded-lg"
                        >
                          <p className="text-sm">{remark.remark}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {[remark.user.firstName, remark.user.lastName]
                              .filter(Boolean)
                              .join(" ") || "Unknown"}{" "}
                            - {new Date(remark.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-base sm:text-lg font-semibold mb-4">
                Assigned Leads
              </h1>

              {leads.length === 0 ? (
                <div className="bg-surface rounded-lg shadow p-8 text-center">
                  <p className="text-text-secondary">
                    No leads assigned to you yet
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {leads.map(lead => {
                    const unresolvedCount =
                      lead.enquiries?.filter(e => e.status === "UNRESOLVED")
                        .length || 0;
                    return (
                      <div
                        key={lead.id}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer rounded-lg bg-surface p-4 shadow outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/40"
                        onClick={() => handleViewLead(lead)}
                        onKeyDown={event => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleViewLead(lead);
                          }
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg">
                                {getLeadFullName(lead.firstName, lead.lastName)}
                              </h3>
                              {unresolvedCount > 0 && (
                                <Tag>
                                  {unresolvedCount}{" "}
                                  {unresolvedCount === 1
                                    ? "Enquiry"
                                    : "Enquiries"}
                                </Tag>
                              )}
                            </div>
                            <p className="text-sm text-text-secondary">
                              {lead.email}
                            </p>
                            {lead.companyName && (
                              <p className="text-sm text-muted-foreground">
                                {lead.companyName}
                              </p>
                            )}
                            {lead.enquiries && lead.enquiries.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Latest enquiry:{" "}
                                {new Date(
                                  lead.enquiries.sort(
                                    (a, b) =>
                                      new Date(b.enquiryCreatedAt).getTime() -
                                      new Date(a.enquiryCreatedAt).getTime()
                                  )[0]?.enquiryCreatedAt || ""
                                ).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <Tag
                            tone={
                              lead.status === "QUALIFIED"
                                ? "active"
                                : lead.status === "UNQUALIFIED"
                                  ? "danger"
                                  : "neutral"
                            }
                          >
                            {lead.status || "OPEN"}
                          </Tag>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </PageShell>
      </div>
    </RoleGuard>
  );
}
