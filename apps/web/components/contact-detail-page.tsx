"use client";

import { toast } from "@/lib/toast";
import { roleHasPermission } from "@repo/db/permissions";
import {
  ActivityItem,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DetailPageHeader,
  InfoField,
} from "@repo/ui";
import { Building2, Edit, MapPin, User } from "@repo/ui/icons";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useAuth } from "../contexts/auth-context";
import { useAnalyticsByContact } from "../hooks/use-analytics";
import { useContact, useUpdateContact } from "../hooks/use-contacts";
import {
  formatAnalyticsDescription,
  formatAnalyticsTitle,
} from "../lib/analytics-events";
import type { Contact as ApiContact } from "../lib/api/types";
import { displayPhone } from "../lib/phone-formatter";
import ContactEditModal, { type ContactEditValues } from "./contact-edit-modal";
import {
  ActivityFeedSkeleton,
  DetailHeaderSkeleton,
  SectionSkeleton,
  StatGridSkeleton,
} from "./skeletons";
import { PageShell } from "@repo/ui/components/ui/page-shell";

interface ContactDetailPageProps {
  contactId: number;
  onBack?: () => void;
}

function displayDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-GB");
}

function optOutStatus(value?: boolean): string {
  return value ? "Opted out" : "Allowed";
}

export function ContactDetailPage({
  contactId,
  onBack,
}: ContactDetailPageProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [editOpen, setEditOpen] = React.useState(false);
  const { data: contact, isLoading, error } = useContact(contactId);
  const { data: analyticsEvents = [], isLoading: analyticsLoading } =
    useAnalyticsByContact(contactId);
  const updateContact = useUpdateContact();
  const canEdit =
    !!user &&
    roleHasPermission(user.role || "", user.permissions, "accounts.manage");

  if (isLoading) {
    return (
      <PageShell>
        <DetailHeaderSkeleton />
        <SectionSkeleton>
          <StatGridSkeleton count={4} />
        </SectionSkeleton>
        <SectionSkeleton>
          <ActivityFeedSkeleton items={3} />
        </SectionSkeleton>
      </PageShell>
    );
  }

  if (error || !contact) {
    return (
      <PageShell>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
          <p className="text-destructive">Failed to load contact details.</p>
          <Button variant="outline" onClick={onBack || (() => router.back())}>
            Go back
          </Button>
        </div>
      </PageShell>
    );
  }

  const activities = analyticsEvents.map(event => ({
    id: event.id,
    title: formatAnalyticsTitle(event.eventType),
    description: formatAnalyticsDescription(event),
    time: displayDate(event.occurredAt),
  }));
  const actions = canEdit
    ? [
        {
          label: "Edit",
          icon: <Edit className="h-4 w-4" />,
          onClick: () => setEditOpen(true),
          variant: "outline" as const,
        },
      ]
    : [];

  const save = async (values: ContactEditValues) => {
    const data: Partial<ApiContact> = {
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone?.trim() || "",
      position: values.position?.trim() || "",
      city: values.city?.trim() || "",
      state: values.state?.trim() || "",
      pincode: values.pincode?.trim() || "",
    };

    try {
      await updateContact.mutateAsync({ id: contactId, data });
      toast.success("Contact updated successfully");
    } catch (updateError) {
      toast.error(updateError, "Failed to update contact");
      throw updateError;
    }
  };

  return (
    <PageShell>
      <DetailPageHeader
        title="Contact details"
        onBack={onBack || (() => router.back())}
        actions={actions}
      />

      <Card className="border shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{contact.name}</h2>
              <p className="text-sm text-muted-foreground">
                {contact.position || "Position not recorded"}
              </p>
            </div>
          </div>
          {contact.account ? (
            <Button
              variant="outline"
              onClick={() =>
                router.push(`/leads/accounts/${contact.accountId}`)
              }
            >
              <Building2 className="mr-2 h-4 w-4" />
              {contact.account.name}
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">
              No account linked
            </span>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoField label="Email" value={contact.email} />
        <InfoField
          label="Phone"
          value={displayPhone(contact.phone, contact.countryCode)}
        />
        <InfoField label="Created" value={displayDate(contact.createdAt)} />
        <InfoField label="Updated" value={displayDate(contact.updatedAt)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-4 w-4" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <InfoField label="City" value={contact.city || "—"} />
            <InfoField label="State" value={contact.state || "—"} />
            <InfoField label="Pincode" value={contact.pincode || "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Communication consent</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <InfoField
              label="Email"
              value={optOutStatus(contact.emailOptOut)}
            />
            <InfoField label="SMS" value={optOutStatus(contact.smsOptOut)} />
            <InfoField
              label="WhatsApp"
              value={optOutStatus(contact.whatsappOptOut)}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[30rem] space-y-2 overflow-y-auto">
            {analyticsLoading ? (
              <ActivityFeedSkeleton items={3} />
            ) : activities.length > 0 ? (
              activities.map(activity => (
                <ActivityItem
                  key={activity.id}
                  title={activity.title}
                  description={activity.description}
                  time={activity.time}
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No recorded activity yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <ContactEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        initialValues={{
          name: contact.name,
          email: contact.email,
          phone: contact.phone || "",
          position: contact.position || "",
          city: contact.city || "",
          state: contact.state || "",
          pincode: contact.pincode || "",
        }}
        isSaving={updateContact.isPending}
        onSave={save}
      />
    </PageShell>
  );
}
