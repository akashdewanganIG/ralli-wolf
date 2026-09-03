import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { opportunityService } from "../lib/api/services";
import {
  CreateOpportunityInput,
  OpportunityListItem,
  OpportunityLineItem,
  OpportunityQuoteListItem,
} from "../lib/api/types";
import type { QuoteDetail } from "../lib/api/types";

export const opportunityKeys = {
  all: ["opportunities"] as const,
  lists: () => [...opportunityKeys.all, "list"] as const,
  list: (filters: { page?: number; limit?: number }) =>
    [...opportunityKeys.lists(), filters] as const,
  details: () => [...opportunityKeys.all, "detail"] as const,
  detail: (id: number) => [...opportunityKeys.details(), id] as const,
  lineItemsAll: () => [...opportunityKeys.all, "line-items"] as const,
  lineItems: (opportunityId: number) =>
    [...opportunityKeys.lineItemsAll(), opportunityId] as const,
  quotesAll: () => [...opportunityKeys.all, "quotes"] as const,
  quotes: (opportunityId: number, page?: number, limit?: number) =>
    [...opportunityKeys.quotesAll(), opportunityId, page, limit] as const,
};

export function useOpportunitiesWithPagination(filters?: {
  page?: number;
  limit?: number;
}) {
  const query = useQuery({
    queryKey: opportunityKeys.list(filters || {}),
    queryFn: () => opportunityService.getAllOpportunities(filters),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
  return {
    ...query,
    data: (query.data?.data || []) as OpportunityListItem[],
    pagination: query.data?.pagination,
  };
}

export function useOpportunity(id: number) {
  return useQuery({
    queryKey: opportunityKeys.detail(id),
    queryFn: () => opportunityService.getOpportunityById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOpportunityInput) =>
      opportunityService.create(data),
    meta: { successMessage: "Opportunity created successfully" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
    },
  });
}

export function useDeleteOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: opportunityService.deleteOpportunity,
    meta: { successMessage: "Opportunity deleted successfully" },
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({
        queryKey: opportunityKeys.detail(deletedId),
      });
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
    },
  });
}

export function useDeleteOpportunityLineItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      opportunityId,
      lineItemId,
    }: {
      opportunityId: number;
      lineItemId: number;
    }) =>
      opportunityService.deleteOpportunityLineItem(opportunityId, lineItemId),
    meta: { successMessage: "Line item deleted successfully" },
    onSuccess: (_, { opportunityId }) => {
      queryClient.invalidateQueries({
        queryKey: opportunityKeys.lineItems(opportunityId),
      });
      queryClient.invalidateQueries({
        queryKey: opportunityKeys.detail(opportunityId),
      });
    },
  });
}

export function useUpdateOpportunityStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: string }) =>
      opportunityService.updateOpportunity(id, { stage }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: opportunityKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
    },
  });
}

export function useUpdateOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: {
        name?: string;
        expectedCloseDate?: string | null;
        nextStep?: string | null;
        type?: string | null;
        leadSource?: string | null;
        priceBookId?: number | null;
      };
    }) => opportunityService.updateOpportunity(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: opportunityKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
    },
  });
}

export function useAddOpportunityLineItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      opportunityId,
      data,
    }: {
      opportunityId: number;
      data: {
        productId: number;
        quantity?: number;
        listPrice?: number;
        discount?: number;
        description?: string | null;
      };
    }) => opportunityService.addOpportunityLineItem(opportunityId, data),
    onSuccess: (_data, { opportunityId }) => {
      queryClient.invalidateQueries({
        queryKey: opportunityKeys.lineItems(opportunityId),
      });
      queryClient.invalidateQueries({
        queryKey: opportunityKeys.detail(opportunityId),
      });
    },
  });
}

export function useUpdateOpportunityLineItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      opportunityId,
      lineItemId,
      data,
    }: {
      opportunityId: number;
      lineItemId: number;
      data: {
        quantity?: number;
        listPrice?: number;
        discount?: number;
        description?: string | null;
        sortOrder?: number;
      };
    }) =>
      opportunityService.updateOpportunityLineItem(
        opportunityId,
        lineItemId,
        data
      ),
    onSuccess: (_data, { opportunityId }) => {
      queryClient.invalidateQueries({
        queryKey: opportunityKeys.detail(opportunityId),
      });
      queryClient.invalidateQueries({
        queryKey: opportunityKeys.lineItems(opportunityId),
      });
    },
  });
}

export function useOpportunityLineItems(opportunityId: number) {
  return useQuery({
    queryKey: opportunityKeys.lineItems(opportunityId),
    queryFn: () => opportunityService.getOpportunityLineItems(opportunityId),
    enabled: !!opportunityId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    select: res => res.data as OpportunityLineItem[],
  });
}

export function useOpportunityQuotes(
  opportunityId: number,
  params?: { page?: number; limit?: number }
) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 50;
  return useQuery({
    queryKey: opportunityKeys.quotes(opportunityId, page, limit),
    queryFn: () =>
      opportunityService.getOpportunityQuotes(opportunityId, { page, limit }),
    enabled: !!opportunityId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

function quoteDetailToListItem(q: QuoteDetail): OpportunityQuoteListItem {
  return {
    id: q.id,
    quoteNumber: q.quoteNumber,
    name: q.name ?? "",
    status: q.status,
    type: q.type ?? "QUOTE",
    version: q.version ?? 1,
    isPrimary: q.isPrimary,
    grandTotal: q.grandTotal,
    createdAt: q.createdAt ?? new Date().toISOString(),
  };
}

export function useGenerateQuote(opportunityId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body?: {
      validUntil?: string;
      paymentTerms?: string | null;
      deliveryTerms?: string | null;
      notes?: string | null;
      internalNotes?: string | null;
    }) => opportunityService.generateQuote(opportunityId, body),
    onSuccess: (result, _variables, _context) => {
      const createdQuote = result?.data;
      if (createdQuote) {
        const page = 1;
        const limit = 50;
        const queryKey = opportunityKeys.quotes(opportunityId, page, limit);
        queryClient.setQueryData<{
          data: OpportunityQuoteListItem[];
          pagination: { totalItems: number; [key: string]: unknown };
        }>(queryKey, old => {
          const newItem = quoteDetailToListItem(createdQuote);
          const prevData = old?.data ?? [];
          const prevPagination = old?.pagination;
          return {
            data: [newItem, ...prevData],
            pagination: prevPagination
              ? { ...prevPagination, totalItems: prevPagination.totalItems + 1 }
              : {
                  currentPage: 1,
                  totalPages: 1,
                  totalItems: 1,
                  itemsPerPage: limit,
                  hasNextPage: false,
                  hasPreviousPage: false,
                },
          };
        });
      }
      queryClient.invalidateQueries({ queryKey: opportunityKeys.quotesAll() });
      queryClient.invalidateQueries({
        queryKey: opportunityKeys.detail(opportunityId),
      });
    },
  });
}
