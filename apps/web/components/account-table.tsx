"use client";

import React from "react";
import { DataTable, TableColumn } from "./data-table";
import { Account } from "../lib/api/types";
import AccountEditModal, { AccountEditValues } from "./account-edit-modal";
import { useUpdateAccount } from "@/hooks/use-accounts";
import { toast } from "@/lib/toast";
import { safeHttpUrl } from "@/lib/validation";

interface AccountTableProps {
  accounts: Account[];
  onAccountClick?: (account: Account) => void;
  showCheckboxes?: boolean;
  selectedItems?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;

  searchQuery?: string;
  isSearchMode?: boolean;

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
  showCheckboxes = false,
  selectedItems = [],
  onSelectionChange,

  searchQuery,
  isSearchMode = false,

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

        const website = safeHttpUrl(String(value));
        const cleanDomain = String(value)
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "");

        let displayText = cleanDomain;
        if (cleanDomain.length > 20) {
          displayText = `${cleanDomain.slice(0, 7)}...${cleanDomain.slice(-7)}`;
        }

        return website ? (
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-info-foreground hover:text-info"
          >
            {displayText}
          </a>
        ) : (
          <span className="text-muted-foreground">{displayText}</span>
        );
      },
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
        columnPreferenceKey="account-table"
      />
      <AccountEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        initialValues={{
          name: editingAccount?.name || "",
          industry: editingAccount?.industry || "",
          website: editingAccount?.website || "",
          phone: editingAccount?.phone || "",
          description: editingAccount?.description || "",
        }}
        isSaving={updateAccountMutation.isPending}
        onSave={async (values: AccountEditValues) => {
          if (!editingAccount) return;
          try {
            await updateAccountMutation.mutateAsync({
              id: editingAccount.id,
              data: values,
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
