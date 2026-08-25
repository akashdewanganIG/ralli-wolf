"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { financeService, planningService } from "@/lib/api/financeServices";
import { toast } from "@/lib/toast";

/** Query keys for finance and planning. */
export const financeKeys = {
  dashboard: ["finance", "dashboard"] as const,
  payables: (params?: unknown) =>
    ["finance", "payables", params ?? {}] as const,
  receivables: (params?: unknown) =>
    ["finance", "receivables", params ?? {}] as const,
  payments: (params?: unknown) =>
    ["finance", "payments", params ?? {}] as const,
  uninvoiced: ["finance", "uninvoiced"] as const,
};

export const planningKeys = {
  board: ["planning", "board"] as const,
  capacity: (params?: unknown) =>
    ["planning", "capacity", params ?? {}] as const,
  workCenters: (params?: unknown) =>
    ["planning", "work-centers", params ?? {}] as const,
};

/** Everything a payment touches, so nothing on screen is left stale. */
function invalidateMoney(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["finance"] });
}

export function useFinanceDashboard() {
  return useQuery({
    queryKey: financeKeys.dashboard,
    queryFn: () => financeService.dashboard(),
    staleTime: 30_000,
  });
}

export function usePayables(params?: {
  status?: string;
  supplierId?: number;
  overdue?: boolean;
}) {
  return useQuery({
    queryKey: financeKeys.payables(params),
    queryFn: () => financeService.payables(params),
  });
}

export function useReceivables(params?: {
  status?: string;
  accountId?: number;
  overdue?: boolean;
}) {
  return useQuery({
    queryKey: financeKeys.receivables(params),
    queryFn: () => financeService.receivables(params),
  });
}

export function usePayments(params?: { direction?: "OUTGOING" | "INCOMING" }) {
  return useQuery({
    queryKey: financeKeys.payments(params),
    queryFn: () => financeService.payments(params),
  });
}

export function useUninvoiced() {
  return useQuery({
    queryKey: financeKeys.uninvoiced,
    queryFn: () => financeService.uninvoiced(),
  });
}

export function useFinanceMutations() {
  const qc = useQueryClient();

  const createPayable = useMutation({
    mutationFn: financeService.createPayable,
    onSuccess: res => {
      invalidateMoney(qc);
      toast.success(`Supplier invoice ${res.data.invoiceNumber} raised`);
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e?.response?.data?.error ?? "Could not raise the invoice"),
  });

  const createReceivable = useMutation({
    mutationFn: financeService.createReceivable,
    onSuccess: res => {
      invalidateMoney(qc);
      toast.success(`Invoice ${res.data.invoiceNumber} raised`);
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e?.response?.data?.error ?? "Could not raise the invoice"),
  });

  const approvePayable = useMutation({
    mutationFn: financeService.approvePayable,
    onSuccess: () => {
      invalidateMoney(qc);
      toast.success("Invoice approved for payment");
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e?.response?.data?.error ?? "Could not approve the invoice"),
  });

  const recordPayment = useMutation({
    mutationFn: financeService.recordPayment,
    onSuccess: res => {
      invalidateMoney(qc);
      toast.success(`Payment ${res.data.paymentNumber} recorded`);
    },
    // The server rejects over-allocation and currency mismatches with a plain
    // sentence; showing it beats a generic failure message.
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e?.response?.data?.error ?? "Could not record the payment"),
  });

  return { createPayable, createReceivable, approvePayable, recordPayment };
}

export function usePlanningBoard() {
  return useQuery({
    queryKey: planningKeys.board,
    queryFn: () => planningService.board(),
  });
}

export function useCapacityLoad(params?: {
  days?: number;
  warehouseId?: number;
}) {
  return useQuery({
    queryKey: planningKeys.capacity(params),
    queryFn: () => planningService.capacity(params),
  });
}

export function useWorkCenters(params?: {
  warehouseId?: number;
  activeOnly?: boolean;
}) {
  return useQuery({
    queryKey: planningKeys.workCenters(params),
    queryFn: () => planningService.workCenters(params),
  });
}

export function usePlanningMutations() {
  const qc = useQueryClient();

  const scheduleOrder = useMutation({
    mutationFn: planningService.scheduleOrder,
    onSuccess: res => {
      qc.invalidateQueries({ queryKey: ["planning"] });
      const hours = Math.round((res.data.totalMinutes / 60) * 10) / 10;
      toast.success(
        `${res.data.orderNumber} scheduled — ${res.data.operations.length} operations, ${hours}h`
      );
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e?.response?.data?.error ?? "Could not schedule the order"),
  });

  const createWorkCenter = useMutation({
    mutationFn: planningService.createWorkCenter,
    onSuccess: res => {
      qc.invalidateQueries({ queryKey: ["planning"] });
      toast.success(`Work centre ${res.data.code} created`);
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(
        e?.response?.data?.error ?? "Could not create the work centre"
      ),
  });

  return { scheduleOrder, createWorkCenter };
}
