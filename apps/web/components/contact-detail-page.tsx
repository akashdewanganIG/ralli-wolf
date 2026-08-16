"use client";

import { toast } from "@/lib/toast";
import {
  ActivityItem,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DetailPageHeader,
  InfoField,
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from "@repo/ui";
import {
  Clock,
  Edit,
  FileText,
  Globe,
  Link2,
  Mail,
  MapPin,
  Phone,
  Tag,
  User,
} from "lucide-react";
import * as React from "react";
import { useAnalyticsByContact } from "../hooks/useAnalytics";
import { useContact, useUpdateContact } from "../hooks/useContacts";
import {
  formatAnalyticsDescription,
  formatAnalyticsTitle,
} from "../lib/analytics-events";
import type { Contact as ApiContact } from "../lib/api/types";
import { displayPhone } from "../lib/phone-formatter";
import ContactEditModal from "./contact-edit-modal";
import {
  ActivityFeedSkeleton,
  DetailHeaderSkeleton,
  DetailSidebarSkeleton,
  ListSkeleton,
  SectionSkeleton,
  StatGridSkeleton,
} from "./skeletons";

interface Contact {
  id: string;
  name: string;
  accountName: string;
  position: string;
  email: string;
  phone: string;
  mailingAddress: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  description: string;
  linkedin: string;
  preferredContactMethod: string;
  alternateEmail: string;
  timeZone: string;
  createdBy: string;
  lastUpdatedBy: string;
  contactStatus: string;
  assignedAtDisplay?: string;
}

interface ContactDetailPageProps {
  contactId: number;
  onBack?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSendEmail?: () => void;
  onSendWhatsApp?: () => void;
  onScheduleMeeting?: () => void;
  onUpload?: () => void;
  onDownload?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
}

export function ContactDetailPage({
  contactId,
  onBack,
  onEdit,
  onSave,
}: ContactDetailPageProps) {
  const [isEditing] = React.useState(false);
  const [editModalOpen, setEditModalOpen] = React.useState(false);

  // API hooks
  const {
    data: contact,
    isLoading: contactLoading,
    error: contactError,
  } = useContact(contactId);
  const { data: analyticsEvents = [], isLoading: analyticsLoading } =
    useAnalyticsByContact(contactId);
  const updateContactMutation = useUpdateContact();

  // Transform API contact data to expected format
  const transformedContact = React.useMemo(() => {
    if (!contact) return null;
    const latestAssignedAt = contact.convertedLeads
      ?.map(lead => lead.assignedAt)
      ?.filter((value): value is string => Boolean(value))
      ?.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())?.[0];
    const assignedAtDisplay = latestAssignedAt
      ? new Date(latestAssignedAt).toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : "Not assigned yet";

    return {
      id: contact.id.toString(),
      name: contact.name || "Unknown",
      accountName: contact.account?.name || "N/A",
      position: contact.position || "N/A",
      email: contact.email || "N/A",
      phone: displayPhone(contact.phone, contact.countryCode),
      mailingAddress: "N/A", // Not available from API
      city: "N/A", // Not available from API
      state: "N/A", // Not available from API
      zipCode: "N/A", // Not available from API
      country: "N/A", // Not available from API
      description:
        contact.position && contact.account?.name
          ? `${contact.name} is a ${contact.position} at ${contact.account.name}, responsible for driving business growth and maintaining client relationships.`
          : contact.position
            ? `${contact.name} is a ${contact.position}, responsible for driving business growth and maintaining client relationships.`
            : contact.account?.name
              ? `${contact.name} works at ${contact.account.name}, responsible for driving business growth and maintaining client relationships.`
              : `${contact.name} is a contact in our system, responsible for driving business growth and maintaining client relationships.`,
      linkedin: "N/A", // Not available from API
      preferredContactMethod: "N/A", // Not available from API
      alternateEmail: "N/A", // Not available from API
      timeZone: "N/A", // Not available from API
      createdBy: new Date(contact.createdAt).toLocaleDateString(),
      lastUpdatedBy: new Date(contact.updatedAt).toLocaleDateString(),
      contactStatus: "N/A", // Not available from API
      assignedAtDisplay,
    };
  }, [contact]);

  // Local state for editing
  const [editedContact, setEditedContact] = React.useState<Partial<Contact>>(
    {}
  );

  // Update edited contact when contact data changes, but only if not currently editing
  React.useEffect(() => {
    if (transformedContact && !isEditing) {
      setEditedContact(transformedContact);
    }
  }, [transformedContact, isEditing]);

  // Initialize edited contact when entering edit mode
  React.useEffect(() => {
    if (isEditing && transformedContact) {
      setEditedContact(transformedContact);
    }
  }, [isEditing, transformedContact]);

  const handleFieldChange = (field: keyof Contact, value: string) => {
    setEditedContact(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const actions = React.useMemo(() => {
    const actionList = [];

    if (onEdit) {
      actionList.push({
        label: "Edit",
        icon: <Edit className="h-4 w-4" />,
        onClick: () => setEditModalOpen(true),
        variant: "outline" as const,
      });
    }

    return actionList;
  }, [onEdit]);

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

  // Loading and error states
  if (contactLoading) {
    return (
      <div className="space-y-5 p-4">
        <DetailHeaderSkeleton />
        <SectionSkeleton>
          <StatGridSkeleton count={4} />
        </SectionSkeleton>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <SectionSkeleton>
              <ListSkeleton rows={4} />
            </SectionSkeleton>
            <ActivityFeedSkeleton items={3} />
          </div>
          <div className="space-y-4">
            <DetailSidebarSkeleton />
            <DetailSidebarSkeleton items={4} />
          </div>
        </div>
      </div>
    );
  }

  if (contactError || !contact || !transformedContact) {
    return (
      <div className="min-h-[60vh] p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load contact details</p>
          <Button onClick={onBack} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* @ts-ignore */}
      <DetailPageHeader
        title={
          isEditing
            ? editedContact.name || ""
            : transformedContact?.name || "Contact"
        }
        onBack={onBack}
        actions={actions}
      />

      {/* Basic Information Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* @ts-ignore */}
        <InfoField
          label="Account Name"
          value={editedContact.accountName || ""}
          editable={isEditing}
          onChange={value => handleFieldChange("accountName", value)}
        />
        {/* @ts-ignore */}
        <InfoField
          label="Position"
          value={editedContact.position || ""}
          editable={isEditing}
          onChange={value => handleFieldChange("position", value)}
        />
        {/* @ts-ignore */}
        <InfoField
          label="Email"
          value={editedContact.email || ""}
          editable={isEditing}
          onChange={value => handleFieldChange("email", value)}
        />
        {/* @ts-ignore */}
        <InfoField
          label="Phone"
          value={editedContact.phone || ""}
          editable={isEditing}
          onChange={value => handleFieldChange("phone", value)}
        />
        {/* @ts-ignore */}
        <InfoField
          label="Assigned On"
          value={editedContact.assignedAtDisplay || "Not assigned yet"}
          editable={false}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="related">
        <TabsList>
          <TabsTrigger value="related">Related</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContents className="mt-4">
          <TabsContent value="related">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-4">
                {/* Account Information */}
                {/* @ts-ignore */}
                <Card>
                  {/* @ts-ignore */}
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      {/* @ts-ignore */}
                      <CardTitle className="text-lg">
                        Account Information
                      </CardTitle>
                      <Button size="sm" className="bg-black hover:bg-gray-800">
                        View Full Account
                      </Button>
                    </div>
                  </CardHeader>
                  {/* @ts-ignore */}
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {/* @ts-ignore */}
                      <InfoField
                        label="Account Name"
                        value={transformedContact.accountName || ""}
                        editable={false}
                      />
                      {/* @ts-ignore */}
                      <InfoField
                        label="Industry"
                        value="N/A"
                        editable={false}
                      />
                      {/* @ts-ignore */}
                      <InfoField label="Website" value="N/A" editable={false} />
                      {/* @ts-ignore */}
                      <InfoField
                        label="Account Owner"
                        value={transformedContact.name || ""}
                        editable={false}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Activity Timeline */}
                {/* @ts-ignore */}
                <Card>
                  {/* @ts-ignore */}
                  <CardHeader>
                    {/* @ts-ignore */}
                    <CardTitle className="text-lg">Activity Timeline</CardTitle>
                  </CardHeader>
                  {/* @ts-ignore */}
                  <CardContent>
                    <div className="max-h-[400px] overflow-y-auto">
                      {analyticsLoading ? (
                        <ActivityFeedSkeleton items={3} />
                      ) : formattedActivities.length > 0 ? (
                        <div className="space-y-2">
                          {formattedActivities.map(activity => (
                            <ActivityItem
                              key={activity.id}
                              title={activity.title}
                              description={activity.description}
                              time={activity.time}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-sm">
                          No recorded activity yet.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column */}
              <div className="space-y-4">{/* Quick Actions */}</div>
            </div>
          </TabsContent>

          <TabsContent value="details">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-4">
                {/* Address Information */}
                {/* @ts-ignore */}
                <Card>
                  {/* @ts-ignore */}
                  <CardHeader>
                    {/* @ts-ignore */}
                    <CardTitle className="text-lg">
                      Address Information
                    </CardTitle>
                  </CardHeader>
                  {/* @ts-ignore */}
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                          <MapPin className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                            Mailing Address
                          </p>
                          <p className="text-sm font-medium text-gray-700">
                            {editedContact.mailingAddress || "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-50">
                            <MapPin className="h-3.5 w-3.5 text-violet-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              City
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {editedContact.city || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-50">
                            <MapPin className="h-3.5 w-3.5 text-sky-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              State
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {editedContact.state || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-teal-50">
                            <Tag className="h-3.5 w-3.5 text-teal-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Zip Code
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {editedContact.zipCode || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange-50">
                            <Globe className="h-3.5 w-3.5 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Country
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {editedContact.country || "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Information */}
                {/* @ts-ignore */}
                <Card>
                  {/* @ts-ignore */}
                  <CardHeader>
                    {/* @ts-ignore */}
                    <CardTitle className="text-lg">
                      Additional Information
                    </CardTitle>
                  </CardHeader>
                  {/* @ts-ignore */}
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100">
                          <FileText className="h-3.5 w-3.5 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                            Description / Notes
                          </p>
                          <p className="text-sm font-medium text-gray-700 leading-relaxed">
                            {editedContact.description || "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                            <Link2 className="h-3.5 w-3.5 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              LinkedIn
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {editedContact.linkedin || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-purple-50">
                            <Phone className="h-3.5 w-3.5 text-purple-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Preferred Contact
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {editedContact.preferredContactMethod || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-50">
                            <Mail className="h-3.5 w-3.5 text-sky-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Alternate Email
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {editedContact.alternateEmail || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50">
                            <Globe className="h-3.5 w-3.5 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Time Zone
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {editedContact.timeZone || "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* System Information */}
                {/* @ts-ignore */}
                <Card>
                  {/* @ts-ignore */}
                  <CardHeader>
                    {/* @ts-ignore */}
                    <CardTitle className="text-lg">
                      System Information
                    </CardTitle>
                  </CardHeader>
                  {/* @ts-ignore */}
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                          <Clock className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                            Created At
                          </p>
                          <p className="text-sm font-medium text-gray-700">
                            {transformedContact.createdBy}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-purple-50">
                          <Clock className="h-3.5 w-3.5 text-purple-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                            Last Updated
                          </p>
                          <p className="text-sm font-medium text-gray-700">
                            {transformedContact.lastUpdatedBy}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-green-50">
                          <User className="h-3.5 w-3.5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                            Contact Status
                          </p>
                          <Badge
                            variant={
                              transformedContact.contactStatus === "N/A"
                                ? "outline"
                                : "default"
                            }
                            className={
                              transformedContact.contactStatus === "N/A"
                                ? "text-muted-foreground"
                                : ""
                            }
                          >
                            {transformedContact.contactStatus}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </TabsContents>
      </Tabs>

      {/* Edit Contact Modal */}
      <ContactEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        initialValues={{
          name: transformedContact.name,
          email: transformedContact.email,
          phone:
            transformedContact.phone === "N/A" ? "" : transformedContact.phone,
          position:
            transformedContact.position === "N/A"
              ? ""
              : transformedContact.position,
        }}
        isSaving={updateContactMutation.isPending}
        onSave={async vals => {
          try {
            await updateContactMutation.mutateAsync({
              id: contactId,
              data: vals as Partial<ApiContact>,
            });
            toast.success("Contact updated successfully!");
            onSave?.();
          } catch (error) {
            toast.error(
              `Failed to update contact: ${error instanceof Error ? error.message : "Unknown error"}`
            );
            throw error;
          }
        }}
      />
    </div>
  );
}
