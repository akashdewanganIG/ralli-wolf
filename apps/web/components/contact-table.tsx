"use client";

import { useUpdateContact } from "@/hooks/useContacts";
import { displayPhone } from "@/lib/phone-formatter";
import { toast } from "@/lib/toast";
import React from "react";
import ContactEditModal, { ContactEditValues } from "./contact-edit-modal";
import { DataTable, TableColumn } from "./data-table";
import { Contact } from "./data-types";

interface ContactTableProps {
  contacts: Contact[];
  onContactClick?: (contact: Contact) => void;
  onDeleteContact?: (contact: Contact) => void;
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

export const ContactTable: React.FC<ContactTableProps> = ({
  contacts,
  onContactClick,
  onDeleteContact,
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
  const [editingContact, setEditingContact] = React.useState<Contact | null>(
    null
  );
  const updateContactMutation = useUpdateContact();

  const columns: TableColumn<Contact>[] = [
    {
      key: "name",
      label: "Contact Name",
      render: value => (
        <div className="flex items-center gap-2 py-2">
          <span className="text-muted-foreground hover:text-info">
            {value || "Unknown Contact"}
          </span>
        </div>
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
      key: "phone",
      label: "Phone",
      render: (_value, item) => (
        <span className="text-muted-foreground">
          {displayPhone(item.phone, item.countryCode)}
        </span>
      ),
    },
    {
      key: "position",
      label: "Position",
      render: value => (
        <span className="text-muted-foreground">
          {value || "No position specified"}
        </span>
      ),
    },
    {
      key: "accountName",
      label: "Account Name",
      render: value => (
        <span className="text-muted-foreground">
          {value || "No account linked"}
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

    // {
    //   key: "source",
    //   label: "Source",
    //   render: (value, contact) => {
    //     return (
    //       <div className="flex items-center gap-2">
    //         {contact.isConvertedLead ? (
    //             Converted
    //         ) : (
    //             Direct Contact
    //         )}
    //       </div>
    //     )
    //   }
    // }
  ];

  return (
    <>
      <DataTable
        data={contacts}
        columns={columns}
        title="Contacts"
        count={totalCount || contacts.length}
        actionItems={[
          {
            label: "View Details",
            onClick: (contact: Contact) => onContactClick?.(contact),
          },
          {
            label: "Edit Contact",
            onClick: (contact: Contact) => {
              setEditingContact(contact);
              setEditOpen(true);
            },
          },
          { label: "View Account", onClick: () => {} },
          ...(onDeleteContact
            ? [
                {
                  label: "Delete Contact",
                  onClick: (contact: Contact) => onDeleteContact(contact),
                },
              ]
            : []),
        ]}
        onRowClick={onContactClick}
        getRowHref={contact => `/leads/contacts/${contact.id}`}
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
        columnPreferenceKey="contact-table"
      />
      <ContactEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        initialValues={{
          name: editingContact?.name || "",
          email: editingContact?.email || "",
          phone: editingContact?.phone || "",
          position: editingContact?.position || "",
        }}
        isSaving={updateContactMutation.isPending}
        onSave={async (values: ContactEditValues) => {
          if (!editingContact) return;
          try {
            await updateContactMutation.mutateAsync({
              id: parseInt(String(editingContact.id)),
              data: values as any,
            });
            toast.success("Contact updated successfully");
          } catch (err) {
            toast.error(err, "Failed to update contact");
          }
        }}
      />
    </>
  );
};
