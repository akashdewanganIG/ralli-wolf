"use client";

import * as React from "react";
import Link from "next/link";
import {
  DetailPageHeader,
  DetailCard,
  ActivityItem,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Tabs,
  TabsContent,
  DeleteConfirmationDialog,
} from "@repo/ui";
import {
  Edit,
  Trash2,
  ArrowRightLeft,
  User,
  Building2,
  Mail,
  Phone,
  Globe,
  Clock,
  Calendar,
} from "@repo/ui/icons";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { useAnalyticsByLead } from "../hooks/use-analytics";
import { useLead, useDeleteLead, useConvertLead } from "../hooks/use-leads";
import { LeadStatus } from "../lib/api/types";
import {
  formatAnalyticsDescription,
  formatAnalyticsTitle,
} from "../lib/analytics-events";
import EditLeadModal from "./edit-lead-modal";
import { KeywordSelect } from "./keyword-select";
import { getLeadStatusConfig, getLeadSourceLabel } from "../lib/status-config";
import { getLeadFullName } from "../lib/name";
import {
  ActivityFeedSkeleton,
  DetailHeaderSkeleton,
  DetailSidebarSkeleton,
  SectionSkeleton,
  TableSkeleton,
} from "./skeletons";
import { displayPhone } from "../lib/phone-formatter";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { CategorySwitcher } from "@repo/ui/components/ui/category-switcher";
import { roleHasPermission } from "@repo/db/permissions";
import { useAuth } from "../contexts/auth-context";

interface LeadDetailPageProps {
  leadId: number;
  onBack?: () => void;
}

export function LeadDetailPage({ leadId, onBack }: LeadDetailPageProps) {
  const router = useRouter();
  const { user } = useAuth();
  const canManage =
    !!user &&
    roleHasPermission(user.role || "", user.permissions, "leads.manage");
  const [accountContactTab, setAccountContactTab] = React.useState("accounts");
  const [showConvertDialog, setShowConvertDialog] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [convertData, setConvertData] = React.useState({
    keywordIds: [] as number[],
  });

  const {
    data: lead,
    isLoading: leadLoading,
    error: leadError,
  } = useLead(leadId);
  const deleteLeadMutation = useDeleteLead();
  const convertLeadMutation = useConvertLead();

  const contact = lead?.convertedToContact;
  const account = contact?.account;

  const { data: analyticsEvents = [], isLoading: analyticsLoading } =
    useAnalyticsByLead(leadId);

  const formattedActivities = React.useMemo(() => {
    return analyticsEvents.map(event => ({
      id: event.id,
      title: formatAnalyticsTitle(event.eventType),
      description: formatAnalyticsDescription(event),
      time: new Date(event.occurredAt).toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    }));
  }, [analyticsEvents]);

  const [showEditModal, setShowEditModal] = React.useState(false);
  const handleEdit = () => {
    setShowEditModal(true);
  };

  const handleConvert = () => {
    setShowConvertDialog(true);
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleConvertConfirm = async () => {
    try {
      await convertLeadMutation.mutateAsync({
        id: leadId,
        data: convertData,
      });
      setShowConvertDialog(false);
      toast.success("Lead converted to contact successfully!");
    } catch (error) {
      toast.error(
        `Failed to convert lead: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteLeadMutation.mutateAsync(leadId);
      setShowDeleteDialog(false);
      toast.success("Lead deleted successfully!");

      router.push("/leads/lead-master");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (errorMessage.includes("404") || errorMessage.includes("not found")) {
        toast.error("Lead has already been deleted");
        setShowDeleteDialog(false);
        router.push("/leads/lead-master");
      } else {
        toast.error(`Failed to delete lead: ${errorMessage}`);
      }
    }
  };

  const actions = React.useMemo(() => {
    const actionList = [];

    if (canManage && !lead?.convertedToContactId) {
      actionList.push({
        label: convertLeadMutation.isPending ? "Converting..." : "Convert",
        icon: <ArrowRightLeft className="h-4 w-4" />,
        onClick: handleConvert,
        variant: "outline" as const,
        disabled: convertLeadMutation.isPending,
      });
    }

    if (canManage) {
      actionList.push({
        label: deleteLeadMutation.isPending ? "Deleting..." : "Delete",
        icon: <Trash2 className="h-4 w-4" />,
        onClick: handleDelete,
        variant: "destructive" as const,
        disabled: deleteLeadMutation.isPending,
      });
    }

    return actionList;
  }, [
    lead?.convertedToContactId,
    canManage,
    convertLeadMutation.isPending,
    deleteLeadMutation.isPending,
  ]);

  if (leadLoading) {
    return (
      <PageShell>
        <DetailHeaderSkeleton />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <SectionSkeleton>
              <TableSkeleton rows={4} />
            </SectionSkeleton>
            <SectionSkeleton>
              <TableSkeleton rows={3} />
            </SectionSkeleton>
            <ActivityFeedSkeleton items={4} />
          </div>
          <div className="space-y-4">
            <DetailSidebarSkeleton />
            <DetailSidebarSkeleton items={3} />
          </div>
        </div>
      </PageShell>
    );
  }

  if (leadError || !lead) {
    return (
      <div className="min-h-[60vh] p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load lead details</p>
          <Button onClick={onBack} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const displayName = getLeadFullName(lead.firstName, lead.lastName);

  const currentStatus = lead.status || "OPEN";
  const statusConfig = getLeadStatusConfig(currentStatus as LeadStatus);
  const statusLabel = statusConfig.label;

  return (
    <div className="p-4">
      <DetailPageHeader
        title={displayName}
        status={statusLabel}
        statusTone={statusConfig.tone}
        onBack={onBack}
        actions={actions}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <DetailCard
            title="Lead Details"
            headerActions={
              canManage ? (
                <Button
                  variant="outline"
                  onClick={handleEdit}
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" /> Edit
                </Button>
              ) : undefined
            }
            className="border shadow-sm"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-surface">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                    Lead Name
                  </p>
                  <p className="text-sm font-medium text-text-secondary">
                    {displayName || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-surface">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                    Company
                  </p>
                  <p className="text-sm font-medium text-text-secondary">
                    {lead?.companyName || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-surface">
                  <Mail className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                    Email
                  </p>
                  <p
                    className="text-sm font-medium text-text-secondary truncate"
                    title={lead?.email || "N/A"}
                  >
                    {lead?.email || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-surface">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                    Phone
                  </p>
                  <p className="text-sm font-medium text-text-secondary">
                    {displayPhone(lead?.phone, lead?.countryCode)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-surface">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                    Assigned To
                  </p>
                  <p className="text-sm font-medium text-text-secondary">
                    {[lead?.owner?.firstName, lead?.owner?.lastName]
                      .filter(Boolean)
                      .join(" ") || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-surface">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                    Assigned On
                  </p>
                  <p className="text-sm font-medium text-text-secondary">
                    {lead?.assignedAt
                      ? new Date(lead.assignedAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "Not assigned yet"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-surface">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                    Source
                  </p>
                  <p className="text-sm font-medium text-text-secondary">
                    {lead?.source ? getLeadSourceLabel(lead.source) : "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-surface">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                    Created At
                  </p>
                  <p className="text-sm font-medium text-text-secondary">
                    {lead?.createdAt
                      ? new Date(lead.createdAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </DetailCard>

          <DetailCard title="Activity Timeline">
            <div className="max-h-[25rem] overflow-y-auto space-y-0">
              {analyticsLoading ? (
                <ActivityFeedSkeleton items={3} />
              ) : formattedActivities.length > 0 ? (
                formattedActivities.map(activity => (
                  <React.Fragment key={activity.id}>
                    <ActivityItem
                      title={activity.title}
                      description={activity.description}
                      time={activity.time}
                    />
                  </React.Fragment>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No activities recorded yet</p>
                </div>
              )}
            </div>
          </DetailCard>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-center">
                <Tabs
                  value={accountContactTab}
                  onValueChange={setAccountContactTab}
                >
                  <CategorySwitcher
                    label="Related records"
                    items={[
                      { value: "accounts", label: "Accounts" },
                      { value: "contacts", label: "Contacts" },
                    ]}
                  />
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs
                value={accountContactTab}
                onValueChange={setAccountContactTab}
              >
                <TabsContent value="accounts">
                  {lead?.convertedToContactId ? (
                    account ? (
                      <div className="space-y-3">
                        <Link
                          href={`/leads/accounts/${account.id}`}
                          prefetch={true}
                          className="flex items-center justify-between gap-3 p-3 border rounded-lg cursor-pointer hover:bg-surface-elevated transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 bg-primary-surface rounded-full flex items-center justify-center shrink-0">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-medium text-primary hover:text-foreground truncate">
                                {account.name || "N/A"}
                              </h4>
                              <p className="text-sm text-muted-foreground truncate">
                                {account.industry || "N/A"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right min-w-0 max-w-[45%]">
                            <p
                              className="text-sm truncate"
                              title={account.website || "N/A"}
                            >
                              {account.website || "N/A"}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {account.phone || "N/A"}
                            </p>
                            <p className="text-xs text-primary mt-1">
                              Click to view details
                            </p>
                          </div>
                        </Link>

                        {lead?.keywords && lead.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {lead.keywords.map(leadKeyword => (
                              <Badge
                                key={leadKeyword.id}
                                variant="secondary"
                                className="text-xs"
                              >
                                #{leadKeyword.keyword.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-active rounded-full mx-auto mb-4 flex items-center justify-center">
                          <Building2 className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-medium mb-2">No Account Linked</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          The converted contact is not associated with any
                          account.
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-active rounded-full mx-auto mb-4 flex items-center justify-center">
                        <Building2 className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium mb-2">Lead Not Converted</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        This lead has not been converted yet. Convert the lead
                        to create a contact and optionally link to an account.
                      </p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="contacts">
                  {lead?.convertedToContactId ? (
                    contact ? (
                      <div className="space-y-3">
                        <Link
                          href={`/leads/contacts/${contact.id}`}
                          prefetch={true}
                          className="flex items-center justify-between gap-3 p-3 border rounded-lg cursor-pointer hover:bg-surface-elevated transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 bg-primary-surface rounded-full flex items-center justify-center shrink-0">
                              <User className="h-5 w-5 text-foreground" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-medium text-foreground hover:text-primary truncate">
                                {contact.name || "N/A"}
                              </h4>
                              <p className="text-sm text-muted-foreground truncate">
                                {contact.position || "N/A"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right min-w-0 max-w-[45%]">
                            <p
                              className="text-sm truncate"
                              title={contact.email || "N/A"}
                            >
                              {contact.email || "N/A"}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {displayPhone(contact.phone, contact.countryCode)}
                            </p>
                            <p className="text-xs text-foreground mt-1">
                              Click to view details
                            </p>
                          </div>
                        </Link>

                        {lead?.keywords && lead.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {lead.keywords.map(leadKeyword => (
                              <Badge
                                key={leadKeyword.id}
                                variant="secondary"
                                className="text-xs"
                              >
                                #{leadKeyword.keyword.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-active rounded-full mx-auto mb-4 flex items-center justify-center">
                          <User className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-medium mb-2">Contact Not Found</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          The converted contact could not be loaded.
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-active rounded-full mx-auto mb-4 flex items-center justify-center">
                        <User className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium mb-2">Lead Not Converted</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        This lead has not been converted yet. Convert the lead
                        to create a contact.
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {showConvertDialog && (
        <div className="fixed inset-0 bg-foreground bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-lg p-4 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">
              Convert Lead to Contact
            </h2>
            <p className="text-sm text-text-secondary mb-4">
              Convert &ldquo;{displayName || "this lead"}&rdquo; to a contact.
              You can optionally assign keywords.
            </p>
            <div className="space-y-4">
              <KeywordSelect
                selectedKeywordIds={convertData.keywordIds}
                onSelectionChange={keywordIds =>
                  setConvertData(prev => ({
                    ...prev,
                    keywordIds,
                  }))
                }
                label="Keyword"
                placeholder="Select or create keywords"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setShowConvertDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConvertConfirm}
                disabled={convertLeadMutation.isPending}
              >
                {convertLeadMutation.isPending
                  ? "Converting..."
                  : "Convert Lead"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteConfirm}
        itemName={displayName || "this lead"}
        itemType="lead"
        isLoading={deleteLeadMutation.isPending}
        disabled={deleteLeadMutation.isPending}
      />

      {lead && (
        <EditLeadModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          lead={lead}
        />
      )}
    </div>
  );
}
