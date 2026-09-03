"use client";

import { toast } from "@/lib/toast";
import {
  Button,
  Card,
  CardContent,
  DetailCard,
  DetailPageHeader,
  InfoField,
} from "@repo/ui";
import { Building2, Calendar, Edit, Users } from "@repo/ui/icons";
import { roleHasPermission } from "@repo/db/permissions";
import { safeHttpUrl } from "@/lib/validation";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useAccount, useUpdateAccount } from "../hooks/use-accounts";
import { useAuth } from "../contexts/auth-context";
import type { Account as ApiAccount } from "../lib/api/types";
import { displayPhone } from "../lib/phone-formatter";
import AccountEditModal, { type AccountEditValues } from "./account-edit-modal";
import { DataTable, type TableColumn } from "./data-table";
import {
  DetailHeaderSkeleton,
  SectionSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from "./skeletons";
import { PageShell } from "@repo/ui/components/ui/page-shell";

interface ContactRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  position: string;
  createdAt: string;
}

interface AccountDetailPageProps {
  accountId: number;
  onBack?: () => void;
}

function displayDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-GB");
}

export const AccountDetailPage = React.memo(function AccountDetailPage({
  accountId,
  onBack,
}: AccountDetailPageProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [editOpen, setEditOpen] = React.useState(false);
  const { data: account, isLoading, error } = useAccount(accountId);
  const updateAccount = useUpdateAccount();
  const canEdit =
    !!user &&
    roleHasPermission(user.role || "", user.permissions, "accounts.manage");

  const contacts = React.useMemo<ContactRow[]>(
    () =>
      (account?.contacts || []).map(contact => ({
        id: contact.id,
        name: contact.name || "—",
        email: contact.email || "—",
        phone: displayPhone(contact.phone, contact.countryCode),
        position: contact.position || "—",
        createdAt: displayDate(contact.createdAt),
      })),
    [account?.contacts]
  );

  const contactColumns = React.useMemo<TableColumn<ContactRow>[]>(
    () => [
      { key: "name", label: "Contact name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "position", label: "Position" },
      { key: "createdAt", label: "Created" },
    ],
    []
  );

  if (isLoading) {
    return (
      <PageShell>
        <DetailHeaderSkeleton />
        <SectionSkeleton>
          <StatGridSkeleton count={2} />
        </SectionSkeleton>
        <SectionSkeleton>
          <TableSkeleton rows={5} />
        </SectionSkeleton>
      </PageShell>
    );
  }

  if (error || !account) {
    return (
      <PageShell>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
          <p className="text-destructive">Failed to load account details.</p>
          <Button variant="outline" onClick={onBack || (() => router.back())}>
            Go back
          </Button>
        </div>
      </PageShell>
    );
  }

  const website = account.website ? safeHttpUrl(account.website) : null;
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

  const save = async (values: AccountEditValues) => {
    const data: Partial<ApiAccount> = {
      name: values.name.trim(),
      industry: values.industry?.trim() || "",
      website: values.website?.trim() || "",
      phone: values.phone?.trim() || "",
      description: values.description?.trim() || "",
    };
    try {
      await updateAccount.mutateAsync({ id: accountId, data });
      toast.success("Account updated successfully");
    } catch (updateError) {
      toast.error(updateError, "Failed to update account");
      throw updateError;
    }
  };

  return (
    <PageShell>
      <DetailPageHeader
        title="Account details"
        onBack={onBack || (() => router.back())}
        actions={actions}
      />

      <Card className="border shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{account.name}</h2>
              <p className="text-sm text-muted-foreground">
                {account.industry || "Industry not recorded"}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{contacts.length} contacts</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{displayDate(account.createdAt)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoField label="Industry" value={account.industry || "—"} />
        <InfoField
          label="Website"
          value={account.website || "—"}
          onClick={
            website
              ? () => window.open(website, "_blank", "noopener,noreferrer")
              : undefined
          }
        />
        <InfoField label="Phone" value={account.phone || "—"} />
        <InfoField label="Updated" value={displayDate(account.updatedAt)} />
      </div>

      <DetailCard title="Description">
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {account.description || "No description recorded."}
        </p>
      </DetailCard>

      <DataTable<ContactRow>
        data={contacts}
        columns={contactColumns}
        title="Contacts"
        count={contacts.length}
        onRowClick={contact => router.push(`/leads/contacts/${contact.id}`)}
        getRowHref={contact => `/leads/contacts/${contact.id}`}
        showFilter={false}
      />

      <AccountEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        initialValues={{
          name: account.name,
          industry: account.industry || "",
          website: account.website || "",
          phone: account.phone || "",
          description: account.description || "",
        }}
        isSaving={updateAccount.isPending}
        onSave={save}
      />
    </PageShell>
  );
});
