"use client";

import React from "react";
import { DataTable, TableColumn } from "./data-table";
import { Account } from "../lib/api/types";
import AccountEditModal, { AccountEditValues } from "./account-edit-modal";
import { useUpdateAccount } from "@/hooks/useAccounts";
import { toast } from "@/lib/toast";

interface AccountTableProps {
  accounts: Account[];
  onAccountClick?: (account: Account) => void;
  onDeleteAccount?: (account: Account) => void;
  showCheckboxes?: boolean;
  selectedItems?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  // Search props
  searchQuery?: string;
  isSearchMode?: boolean;
  // Pagination props
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
}

export const AccountTable: React.FC<AccountTableProps> = ({
  accounts,
  onAccountClick,
  onDeleteAccount,
  showCheckboxes = false,
  selectedItems = [],
  onSelectionChange,
  // Search props
  searchQuery,
  isSearchMode = false,
  // Pagination props
  currentPage = 1,
  totalPages = 1,
  totalCount,
  itemsPerPage = 10,
  onPageChange,
  onItemsPerPageChange,
}) => {
  const [editOpen, setEditOpen] = React.useState(false);
  const [editingAccount, setEditingAccount] = React.useState<Account | null>(
    null
  );
  const updateAccountMutation = useUpdateAccount();
  const columns: TableColumn<Account>[] = [
    {
      key: "name",
      label: "Account Name",
      render: value => (
        <div className="flex items-center gap-2 py-2">
          <span className="text-muted-foreground hover:text-info">
            {value || "Unknown Account"}
          </span>
        </div>
      ),
    },
    {
      key: "industry",
      label: "Industry",
      render: value => (
        <span className="text-muted-foreground">
          {value || "Not specified"}
        </span>
      ),
    },
    {
      key: "website",
      label: "Website",
      render: value => {
        if (!value) {
          return (
            <span className="text-muted-foreground">No website provided</span>
          );
        }

        // Remove https://, http://, www. and get just the domain
        const cleanDomain = value
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "");

        // Truncate if longer than 20 chars: show first 7 + "..." + last 7
        let displayText = cleanDomain;
        if (cleanDomain.length > 20) {
          displayText = `${cleanDomain.slice(0, 7)}...${cleanDomain.slice(-7)}`;
        }

        return (
          <a
            href={`https://${cleanDomain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-info-foreground hover:text-info"
          >
            {displayText}
          </a>
        );
      },
    },
    {
      key: "contact",
      label: "Contact",
      render: value => (
        <span className="text-muted-foreground">
          {value || "No contact specified"}
        </span>
      ),
    },
    {
      key: "email",
      label: "Email",
      render: value => (
        <span className="text-muted-foreground">
          {value || "No email provided"}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: "Created At",
      render: value => {
        if (!value)
          return <span className="text-muted-foreground">Unknown date</span>;
        const date = new Date(value);
        const time = date.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        const dateStr = date.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
        });
        return (
          <span className="text-muted-foreground">{`${time}, ${dateStr}`}</span>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        data={accounts}
        columns={columns}
        title="Accounts"
        count={totalCount || accounts.length}
        actionItems={[
          {
            label: "View Details",
            onClick: (account: Account) => onAccountClick?.(account),
          },
          {
            label: "Edit Account",
            onClick: (account: Account) => {
              setEditingAccount(account);
              setEditOpen(true);
            },
          },
          { label: "View Contacts", onClick: () => {} },
          ...(onDeleteAccount
            ? [
                {
                  label: "Delete Account",
                  onClick: (account: Account) => onDeleteAccount(account),
                },
              ]
            : []),
        ]}
        onRowClick={onAccountClick}
        getRowHref={account => `/leads/accounts/${account.id}`}
        showCheckboxes={showCheckboxes}
        selectedItems={selectedItems}
        onSelectionChange={onSelectionChange}
        searchQuery={searchQuery}
        isSearchMode={isSearchMode}
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        onPageChange={onPageChange}
        onItemsPerPageChange={onItemsPerPageChange}
        showFilter={true}
        customFilter={<></>}
        columnPreferenceKey="account-table"
      />
      <AccountEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        initialValues={{
          name: editingAccount?.name || "",
          website: (editingAccount as any)?.website || "",
          email: (editingAccount as any)?.email || "",
          phone: (editingAccount as any)?.phone || "",
        }}
        isSaving={updateAccountMutation.isPending}
        onSave={async (values: AccountEditValues) => {
          if (!editingAccount) return;
          try {
            await updateAccountMutation.mutateAsync({
              id: parseInt(String(editingAccount.id as any)),
              data: values as any,
            });
            toast.success("Account updated successfully");
          } catch (err) {
            toast.error(err, "Failed to update account");
          }
        }}
      />
    </>
  );
};
