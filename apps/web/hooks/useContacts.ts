import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contactService } from "../lib/api/services";
import { Contact, ContactFilters } from "../lib/api/types";

// Query keys
export const contactKeys = {
  all: ["contacts"] as const,
  lists: () => [...contactKeys.all, "list"] as const,
  list: (filters: ContactFilters & { page?: number; limit?: number }) =>
    [
      ...contactKeys.lists(),
      { page: filters?.page, limit: filters?.limit },
    ] as const,
  details: () => [...contactKeys.all, "detail"] as const,
  detail: (id: number) => [...contactKeys.details(), id] as const,
};

// Hooks for fetching contacts
export function useContacts(
  filters?: ContactFilters,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: contactKeys.list(filters || {}),
    queryFn: () => contactService.getAllContacts(filters),
    enabled: options?.enabled !== undefined ? options.enabled : true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useContactsWithPagination(
  filters?: { page?: number; limit?: number },
  options?: { enabled?: boolean }
) {
  const queryKey = contactKeys.list(filters || {});

  const query = useQuery({
    queryKey,
    queryFn: () => {
      console.log(
        "🔄 Fetching contacts - Page:",
        filters?.page,
        "Limit:",
        filters?.limit
      );
      return contactService.getAllContacts(filters);
    },
    enabled: options?.enabled !== undefined ? options.enabled : true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  console.log(
    "📊 Query result - Page:",
    filters?.page,
    "Data length:",
    query.data?.data?.length || 0,
    "Total pages:",
    query.data?.pagination?.totalPages
  );

  return {
    ...query,
    data: query.data?.data || [],
    pagination: query.data?.pagination,
  };
}

export function useContact(id: number) {
  return useQuery({
    queryKey: contactKeys.detail(id),
    queryFn: () => contactService.getContactById(id),
    enabled: !!id,
  });
}

// Hooks for contact mutations
export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: contactService.createContact,
    meta: { successMessage: "Contact created successfully" },
    onSuccess: () => {
      // Invalidate and refetch contacts
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Contact> }) =>
      contactService.updateContact(id, data),
    meta: { successMessage: "Contact updated successfully" },
    onSuccess: updatedContact => {
      // Update the specific contact in cache
      queryClient.setQueryData(
        contactKeys.detail(updatedContact.id),
        updatedContact
      );
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: contactService.deleteContact,
    meta: { successMessage: "Contact deleted successfully" },
    onSuccess: (_, deletedId) => {
      // Remove the contact from cache
      queryClient.removeQueries({ queryKey: contactKeys.detail(deletedId) });
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
    },
  });
}
