"use client";

import { toast } from "@/lib/toast";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
  Button,
  Card,
  CardContent,
  DetailCard,
  DetailPageHeader,
  InfoField,
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from "@repo/ui";
import {
  Building2,
  Calendar,
  Clock,
  DollarSign,
  Edit,
  FileText,
  MapPin,
  User,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useAccount, useUpdateAccount } from "../hooks/useAccounts";
import { useSearchContacts } from "../hooks/useSearchContacts";
import { Account as ApiAccount } from "../lib/api/types";
import { displayPhone } from "../lib/phone-formatter";
import AccountEditModal from "./account-edit-modal";
import { DataTable, TableColumn } from "./data-table";
import {
  ActivityFeedSkeleton,
  DetailHeaderSkeleton,
  DetailSidebarSkeleton,
  SectionSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from "./skeletons";

interface Account {
  id: string;
  name: string;
  industry: string;
  website: string;
  accountOwner: string;
  accountOwnerId: number | null;
  phone: string;
  description: string;
  annualRevenue: string;
  companySize: string;
  billingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    sameAsBilling: boolean;
  };
  createdBy: string;
  lastUpdatedBy: string;
  accountStatus: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  createdAt: string;
}

interface AccountDetailPageProps {
  accountId: number;
  onBack?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSendEmail?: () => void;
  onSendWhatsApp?: () => void;
  onScheduleMeeting?: () => void;
  onAddContact?: () => void;
  onAddOpportunity?: () => void;
  onReassign?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
}

export const AccountDetailPage = React.memo(function AccountDetailPage({
  accountId,
  onBack,
  onEdit,
  onSave,
}: AccountDetailPageProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState("related");
  const [isEditing] = React.useState(false);
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  // API hooks
  const {
    data: apiAccount,
    isLoading: accountLoading,
    error: accountError,
  } = useAccount(accountId);
  const updateAccountMutation = useUpdateAccount();

  // Contact search state
  const [contactSearchQuery] = React.useState("");

  // Contact search functionality
  const { data: searchedContacts } = useSearchContacts(
    contactSearchQuery,
    accountId,
    {
      debounceMs: 500,
      minQueryLength: 2,
    }
  );

  // Transform API account data to expected format
  const account = React.useMemo(() => {
    if (!apiAccount) return null;

    return {
      id: apiAccount.id.toString(),
      name: apiAccount.name || "Unknown",
      industry: apiAccount.industry || "N/A",
      website: apiAccount.website || "N/A",
      accountOwner: apiAccount.contacts?.[0]?.name || "N/A",
      accountOwnerId: apiAccount.contacts?.[0]?.id || null,
      phone: apiAccount.phone || "N/A",
      description:
        apiAccount.description ||
        `${apiAccount.name} is a leading company in the ${apiAccount.industry || "business"} industry, providing innovative solutions and services to clients worldwide.`,
      annualRevenue: "N/A", // Not available from API
      companySize: "N/A", // Not available from API
      billingAddress: {
        street: "N/A", // Not available from API
        city: "N/A", // Not available from API
        state: "N/A", // Not available from API
        zipCode: "N/A", // Not available from API
        country: "N/A", // Not available from API
      },
      shippingAddress: {
        street: "N/A", // Not available from API
        city: "N/A", // Not available from API
        state: "N/A", // Not available from API
        zipCode: "N/A", // Not available from API
        country: "N/A", // Not available from API
        sameAsBilling: true,
      },
      createdBy: new Date(apiAccount.createdAt).toLocaleDateString(),
      lastUpdatedBy: new Date(apiAccount.updatedAt).toLocaleDateString(),
      accountStatus: "Active", // Mock data
    };
  }, [apiAccount]);

  // Transform API contacts data to expected format
  const allContacts: Contact[] = React.useMemo(() => {
    if (!apiAccount?.contacts) return [];

    return apiAccount.contacts.map((contact: any) => ({
      id: contact.id.toString(),
      name: contact.name || "Unknown",
      email: contact.email || "N/A",
      phone: displayPhone(contact.phone, contact.countryCode),
      position: contact.position || "N/A",
      createdAt: new Date(contact.createdAt).toLocaleDateString(),
    }));
  }, [apiAccount?.contacts]);

  // Transform search results to expected format
  const searchContacts: Contact[] = React.useMemo(() => {
    if (!searchedContacts) return [];

    return searchedContacts.map((contact: any) => ({
      id: contact.id.toString(),
      name: contact.name || "Unknown",
      email: contact.email || "N/A",
      phone: displayPhone(contact.phone, contact.countryCode),
      position: contact.position || "N/A",
      createdAt: new Date(contact.createdAt).toLocaleDateString(),
    }));
  }, [searchedContacts]);

  // Determine which contacts to display
  const contacts = React.useMemo(() => {
    return contactSearchQuery.length > 0 ? searchContacts : allContacts;
  }, [contactSearchQuery, searchContacts, allContacts]);

  // Local state for editing
  const [editedAccount, setEditedAccount] = React.useState<Account | null>(
    null
  );

  // Update edited account when account data changes
  React.useEffect(() => {
    if (account && !isEditing) {
      setEditedAccount(account);
    }
  }, [account, isEditing]);

  // Initialize edited account when entering edit mode
  React.useEffect(() => {
    if (isEditing && account) {
      setEditedAccount(account);
    }
  }, [isEditing, account]);

  const handleFieldChange = (field: keyof Account, value: string) => {
    if (!safeEditedAccount) return;

    setEditedAccount(prev =>
      prev
        ? {
            ...prev,
            [field]: value,
          }
        : null
    );
  };

  const handleAddressChange = (
    addressType: "billingAddress" | "shippingAddress",
    field: string,
    value: string
  ) => {
    if (!safeEditedAccount) return;

    setEditedAccount(prev =>
      prev
        ? {
            ...prev,
            [addressType]: {
              ...prev[addressType],
              [field]: value,
            },
          }
        : null
    );
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

  const RelatedTab = () => (
    <div className="space-y-4">
      {(() => {
        const contactColumns: TableColumn<Contact>[] = [
          {
            key: "name",
            label: "Contact Name",
            render: value => (
              <div className="flex items-center gap-2">
                <span className="font-medium text-blue-600 hover:text-blue-800">
                  {value}
                </span>
              </div>
            ),
          },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "position", label: "Position/Title" },
          { key: "createdAt", label: "Created At" },
        ];

        const handleOpenContact = (item: Contact) =>
          router.push(`/contacts/${item.id}`);

        return (
          <DataTable<Contact>
            data={contacts}
            columns={contactColumns}
            title="Contacts"
            count={contacts.length}
            onNameClick={handleOpenContact}
            onRowClick={handleOpenContact}
            getRowHref={contact => `/leads/contacts/${contact.id}`}
            searchQuery={contactSearchQuery}
            isSearchMode={contactSearchQuery.length > 0}
            showFilter={true}
            customFilter={<></>}
          />
        );
      })()}
    </div>
  );

  const DetailsTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left Column */}
      <div className="space-y-4">
        {/* Address Information */}
        {/* @ts-ignore */}
        <DetailCard title="Address Information">
          <div className="space-y-4">
            {/* Billing */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Billing Address
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                    <MapPin className="h-3.5 w-3.5 text-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 flex-1">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                        Street
                      </p>
                      <p className="text-sm font-medium text-gray-700">
                        {safeEditedAccount.billingAddress.street}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                        City
                      </p>
                      <p className="text-sm font-medium text-gray-700">
                        {safeEditedAccount.billingAddress.city}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                        State
                      </p>
                      <p className="text-sm font-medium text-gray-700">
                        {safeEditedAccount.billingAddress.state}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                        Zip Code
                      </p>
                      <p className="text-sm font-medium text-gray-700">
                        {safeEditedAccount.billingAddress.zipCode}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                        Country
                      </p>
                      <p className="text-sm font-medium text-gray-700">
                        {safeEditedAccount.billingAddress.country}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Shipping Address
              </p>
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  checked={safeEditedAccount.shippingAddress.sameAsBilling}
                  disabled={!isEditing}
                  onCheckedChange={checked =>
                    handleAddressChange(
                      "shippingAddress",
                      "sameAsBilling",
                      checked.toString()
                    )
                  }
                />
                <label className="text-sm text-gray-600">
                  Same as billing address
                </label>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-teal-50">
                  <MapPin className="h-3.5 w-3.5 text-teal-500" />
                </div>
                <div className="grid grid-cols-2 gap-3 flex-1">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                      Street
                    </p>
                    <p className="text-sm font-medium text-gray-700">
                      {safeEditedAccount.shippingAddress.street}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                      City
                    </p>
                    <p className="text-sm font-medium text-gray-700">
                      {safeEditedAccount.shippingAddress.city}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                      State
                    </p>
                    <p className="text-sm font-medium text-gray-700">
                      {safeEditedAccount.shippingAddress.state}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                      Zip Code
                    </p>
                    <p className="text-sm font-medium text-gray-700">
                      {safeEditedAccount.shippingAddress.zipCode}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                      Country
                    </p>
                    <p className="text-sm font-medium text-gray-700">
                      {safeEditedAccount.shippingAddress.country}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DetailCard>
      </div>

      {/* Right Column */}
      <div className="space-y-4">
        {/* Additional Information */}
        {/* @ts-ignore */}
        <DetailCard title="Additional Information">
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
                  {safeEditedAccount.description}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-green-50">
                <DollarSign className="h-3.5 w-3.5 text-green-500" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Annual Revenue
                </p>
                <p className="text-sm font-medium text-gray-700">
                  {safeEditedAccount.annualRevenue}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                <Users className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Company Size
                </p>
                <p className="text-sm font-medium text-gray-700">
                  {safeEditedAccount.companySize}
                </p>
              </div>
            </div>
          </div>
        </DetailCard>

        {/* System Information */}
        {/* @ts-ignore */}
        <DetailCard title="System Information">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-50">
                <User className="h-3.5 w-3.5 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Account Owner
                </p>
                <p className="text-sm font-medium text-gray-700">
                  {safeAccount.accountOwner}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                <Clock className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Created At
                </p>
                <p className="text-sm font-medium text-gray-700">
                  {apiAccount?.createdAt
                    ? new Date(apiAccount.createdAt).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })
                    : safeAccount.createdBy}
                </p>
              </div>
            </div>
          </div>
        </DetailCard>
      </div>
    </div>
  );

  // Loading and error states
  if (accountLoading) {
    return (
      <div className="space-y-5 p-4">
        <DetailHeaderSkeleton />
        <SectionSkeleton>
          <StatGridSkeleton count={3} />
        </SectionSkeleton>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <SectionSkeleton>
              <TableSkeleton rows={5} />
            </SectionSkeleton>
            <ActivityFeedSkeleton items={3} />
          </div>
          <div className="space-y-4">
            <DetailSidebarSkeleton />
            <SectionSkeleton>
              <TableSkeleton rows={3} />
            </SectionSkeleton>
          </div>
        </div>
      </div>
    );
  }

  if (accountError || !account || !editedAccount) {
    return (
      <div className="min-h-[60vh] p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load account details</p>
          <Button onClick={onBack} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // At this point, we know account and editedAccount are not null
  const safeAccount = account!;
  const safeEditedAccount = editedAccount!;

  return (
    <div className="p-4">
      {/* @ts-ignore */}
      <DetailPageHeader
        title={"Account Details"}
        onBack={onBack}
        actions={actions}
      />

      {/* Account Overview */}
      <Card className="mb-4 border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Account Info Section */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
                {/* <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background"></div> */}
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  {safeEditedAccount.name}
                </h2>
                {/* {safeEditedAccount.industry && (
                  <p className="text-sm text-muted-foreground mt-1">{safeEditedAccount.industry}</p>
                )} */}
              </div>
            </div>

            {/* Stats Section */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Contacts Stat */}
              <Card className="border shadow-sm min-w-[180px]">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Contacts
                      </p>
                      <p className="text-2xl font-semibold text-foreground mt-0.5">
                        {contacts.length}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Total associated
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Created Date Stat */}
              <Card className="border shadow-sm min-w-[180px]">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Created
                      </p>
                      <p className="text-base font-semibold text-foreground mt-0.5">
                        {safeAccount.createdBy}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Account date
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Basic Information Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* @ts-ignore */}
        <InfoField
          label="Industry"
          value={safeEditedAccount.industry}
          editable={isEditing}
          onChange={value => handleFieldChange("industry", value)}
        />
        {/* @ts-ignore */}
        <InfoField
          label="Website"
          value={safeEditedAccount.website}
          editable={isEditing}
          onChange={value => handleFieldChange("website", value)}
          onClick={
            safeAccount.website && !isEditing
              ? () => window.open(safeAccount.website, "_blank")
              : undefined
          }
        />
        {/* @ts-ignore */}
        <InfoField
          label="Account Owner"
          value={safeEditedAccount.accountOwner}
          editable={isEditing}
          onChange={value => handleFieldChange("accountOwner", value)}
          href={
            safeAccount.accountOwnerId && !isEditing
              ? `/contacts/${safeAccount.accountOwnerId}`
              : undefined
          }
        />
        {/* @ts-ignore */}
        <InfoField
          label="Phone"
          value={safeEditedAccount.phone}
          editable={isEditing}
          onChange={value => handleFieldChange("phone", value)}
        />
      </div>

      {/* Tabs */}
      {/* @ts-ignore */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* @ts-ignore */}
        <TabsList>
          {/* @ts-ignore */}
          <TabsTrigger value="related">Related</TabsTrigger>
          {/* @ts-ignore */}
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* @ts-ignore */}
        <TabsContents className="mt-4">
          {/* @ts-ignore */}
          <TabsContent value="related">
            <RelatedTab />
          </TabsContent>
          {/* @ts-ignore */}
          <TabsContent value="details">
            <DetailsTab />
          </TabsContent>
        </TabsContents>
      </Tabs>

      {/* Edit Account Modal */}
      <AccountEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        initialValues={{
          name: safeEditedAccount.name,
          website:
            safeEditedAccount.website === "N/A"
              ? ""
              : safeEditedAccount.website,
          email: (apiAccount as any)?.email || "",
          phone:
            safeEditedAccount.phone === "N/A" ? "" : safeEditedAccount.phone,
        }}
        isSaving={updateAccountMutation.isPending}
        onSave={async vals => {
          try {
            // Prepare payload: only send allowed, non-empty fields
            const payload: Partial<ApiAccount> = {};
            if (typeof vals.name === "string" && vals.name.trim().length > 0)
              payload.name = vals.name.trim();
            if (
              typeof vals.website === "string" &&
              vals.website.trim().length > 0
            )
              payload.website = vals.website.trim();
            if (typeof vals.phone === "string" && vals.phone.trim().length > 0)
              payload.phone = vals.phone.trim();
            // Do not send email; not supported by account update API

            await updateAccountMutation.mutateAsync({
              id: accountId,
              data: payload,
            });
            toast.success("Account updated successfully!");
            onSave?.();
          } catch (error) {
            if ((error as any)?.response?.status === 403) {
              toast.error("Only System Admin can update accounts.");
            } else {
              toast.error("Failed to update account. Please try again.");
            }
            throw error;
          }
        }}
      />
    </div>
  );
});
