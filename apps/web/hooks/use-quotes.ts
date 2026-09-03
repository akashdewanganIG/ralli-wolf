import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { quoteService, type GetQuotesParams } from "../lib/api/services";
import type {
  QuoteListItem,
  QuoteDetail,
  QuoteLineItemApi,
  QuoteOrderItem,
} from "../lib/api/types";

export const quoteKeys = {
  all: ["quotes"] as const,
  lists: () => [...quoteKeys.all, "list"] as const,
  list: (params?: GetQuotesParams) =>
    [...quoteKeys.lists(), params ?? {}] as const,
  details: () => [...quoteKeys.all, "detail"] as const,
  detail: (id: string | undefined) => [...quoteKeys.details(), id] as const,
  lineItems: (
    quoteId: string | undefined,
    params?: { page?: number; limit?: number }
  ) => [...quoteKeys.all, "line-items", quoteId, params ?? {}] as const,
  orders: (quoteId: string | undefined) =>
    [...quoteKeys.all, "orders", quoteId] as const,
};

export function useQuotesWithPagination(
  params?: GetQuotesParams,
  options?: { enabled?: boolean }
) {
  const queryKey = quoteKeys.list(params);

  const query = useQuery({
    queryKey,
    queryFn: () => quoteService.getQuotes(params),
    enabled: options?.enabled !== undefined ? options.enabled : true,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  return {
    ...query,
    data: (query.data?.data ?? []) as QuoteListItem[],
    pagination: query.data?.pagination,
  };
}

export function useQuote(quoteId: string | undefined) {
  const numericId =
    quoteId !== undefined && quoteId !== "" ? Number(quoteId) : NaN;
  const enabled = !Number.isNaN(numericId) && numericId > 0;

  const query = useQuery({
    queryKey: quoteKeys.detail(quoteId),
    queryFn: () => quoteService.getQuoteById(numericId),
    enabled,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    data: query.data as QuoteDetail | undefined,
  };
}

export function useQuoteLineItems(
  quoteId: string | undefined,
  params?: { page?: number; limit?: number },
  options?: { enabled?: boolean }
) {
  const numericId =
    quoteId !== undefined && quoteId !== "" ? Number(quoteId) : NaN;
  const enabled =
    (options?.enabled !== undefined ? options.enabled : true) &&
    !Number.isNaN(numericId) &&
    numericId > 0;

  const query = useQuery({
    queryKey: quoteKeys.lineItems(quoteId, params),
    queryFn: () => quoteService.getQuoteLineItems(numericId, params),
    enabled,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    data: (query.data?.data ?? []) as QuoteLineItemApi[],
    pagination: query.data?.pagination,
  };
}

export function useQuoteOrder(
  quoteId: string | undefined,
  options?: { enabled?: boolean }
) {
  const numericId =
    quoteId !== undefined && quoteId !== "" ? Number(quoteId) : NaN;
  const enabled =
    (options?.enabled !== undefined ? options.enabled : true) &&
    !Number.isNaN(numericId) &&
    numericId > 0;

  const query = useQuery({
    queryKey: quoteKeys.orders(quoteId),
    queryFn: () => quoteService.getQuoteOrders(numericId),
    enabled,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    data: (query.data?.data?.[0] ?? null) as QuoteOrderItem | null,
  };
}

export function useGenerateOrder(quoteId: string | undefined) {
  const queryClient = useQueryClient();
  const numericId =
    quoteId !== undefined && quoteId !== "" ? Number(quoteId) : NaN;

  return useMutation({
    mutationFn: () => quoteService.generateOrder(numericId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
      queryClient.invalidateQueries({ queryKey: quoteKeys.orders(quoteId) });
    },
  });
}

export function useSetPrimaryQuote(quoteId: string | undefined) {
  const queryClient = useQueryClient();
  const numericId =
    quoteId !== undefined && quoteId !== "" ? Number(quoteId) : NaN;

  return useMutation({
    mutationFn: () => quoteService.setPrimary(numericId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
    },
  });
}

const QUOTE_STATUS_API_VALUES = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "PRESENTING",
  "PRESENTED",
  "ACCEPTED",
] as const;

export function useUpdateQuoteStatus(quoteId: string | undefined) {
  const queryClient = useQueryClient();
  const numericId =
    quoteId !== undefined && quoteId !== "" ? Number(quoteId) : NaN;

  return useMutation({
    mutationFn: (status: string) =>
      quoteService.updateQuoteStatus(numericId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
    },
  });
}

export function useSubmitQuoteForApproval(quoteId: string | undefined) {
  const queryClient = useQueryClient();
  const numericId =
    quoteId !== undefined && quoteId !== "" ? Number(quoteId) : NaN;

  return useMutation({
    mutationFn: (body: { requestedToId: number; comment?: string }) =>
      quoteService.submitForApproval(numericId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
  });
}

export function useSendQuoteToClient(quoteId: string | undefined) {
  const queryClient = useQueryClient();
  const numericId =
    quoteId !== undefined && quoteId !== "" ? Number(quoteId) : NaN;

  return useMutation({
    mutationFn: (body: {
      to: string;
      subject?: string;
      message?: string;
      cc?: string[];
      bcc?: string[];
    }) => quoteService.sendToClient(numericId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
    },
  });
}

export { QUOTE_STATUS_API_VALUES };
