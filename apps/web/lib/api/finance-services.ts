import apiClient from "./client";

export type InvoiceStatus =
  | "DRAFT"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED"
  | "WRITTEN_OFF";

export type AgeingBucket = {
  label: string;
  amount: string;
  count: number;
};

export type FinanceSide = {
  currencyCode: string;
  outstanding: string;
  overdue: string;
  overdueCount: number;
  openCount: number;
  ageing: Record<string, AgeingBucket>;

  currencies: string[];
  byCurrency: Record<string, Omit<FinanceSide, "currencies" | "byCurrency">>;
};

export type CashFlow = {
  amount: string;
  count: number;
  currencyCode: string;
  currencies: string[];
};

export type FinanceDashboard = {
  asOf: string;
  payables: FinanceSide;
  receivables: FinanceSide;

  netPosition: string | null;
  netPositionCurrency: string | null;
  last30Days: {
    paidOut: CashFlow;
    receivedIn: CashFlow;
  };
  recentPayments: PaymentRow[];
};

export type SupplierInvoiceRow = {
  id: number;
  invoiceNumber: string;
  supplierRef: string | null;
  status: InvoiceStatus;
  invoiceDate: string;
  dueDate: string;
  currencyCode: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  outstanding: string;
  ageing: { days: number; bucket: string; label: string };
  supplier: { id: number; code: string; name: string };
  purchaseOrder: { id: number; poNumber: string } | null;
  grn: { id: number; grnNumber: string } | null;
};

export type CustomerInvoiceRow = {
  id: number;
  invoiceNumber: string;
  status: InvoiceStatus;
  invoiceDate: string;
  dueDate: string;
  currencyCode: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  outstanding: string;
  ageing: { days: number; bucket: string; label: string };
  account: { id: number; name: string };
  salesOrder: { id: number; orderNumber: string } | null;
};

export type PaymentRow = {
  id: number;
  paymentNumber: string;
  direction: "OUTGOING" | "INCOMING";
  method: string;
  reference: string | null;
  paymentDate: string;
  currencyCode: string;
  amount: string;
  unallocated: string;
  supplier?: { id: number; code: string; name: string } | null;
  account?: { id: number; name: string } | null;
  recordedBy?: { firstName: string | null; lastName: string | null } | null;
  allocations?: {
    id: number;
    amount: string;
    supplierInvoice?: { invoiceNumber: string } | null;
    customerInvoice?: { invoiceNumber: string } | null;
  }[];
};

export type UninvoicedDocuments = {
  purchaseOrders: {
    id: number;
    poNumber: string;
    orderDate: string;
    currencyCode: string;
    subtotal: string | null;
    taxAmount: string | null;
    grandTotal: string | null;
    supplier: { id: number; code: string; name: string };
  }[];
  salesOrders: {
    id: number;
    orderNumber: string;
    orderDate: string | null;
    subtotal: string | null;
    taxAmount: string | null;
    grandTotal: string | null;
    account: { id: number; name: string };
  }[];
};

export const financeService = {
  dashboard: async (): Promise<{ data: FinanceDashboard }> =>
    (await apiClient.get("/api/finance/dashboard")).data,

  uninvoiced: async (): Promise<{ data: UninvoicedDocuments }> =>
    (await apiClient.get("/api/finance/uninvoiced")).data,

  payables: async (params?: {
    status?: string;
    supplierId?: number;
    overdue?: boolean;
  }): Promise<{ data: SupplierInvoiceRow[] }> =>
    (await apiClient.get("/api/finance/payables", { params })).data,

  receivables: async (params?: {
    status?: string;
    accountId?: number;
    overdue?: boolean;
  }): Promise<{ data: CustomerInvoiceRow[] }> =>
    (await apiClient.get("/api/finance/receivables", { params })).data,

  createPayable: async (payload: {
    purchaseOrderId?: number;
    supplierId?: number;
    grnId?: number;
    supplierRef?: string;
    currencyCode?: string;
    invoiceDate?: string;
    dueDate?: string;
    subtotal?: string;
    taxAmount?: string;
    notes?: string;
  }): Promise<{ data: SupplierInvoiceRow }> =>
    (await apiClient.post("/api/finance/payables", payload)).data,

  approvePayable: async (id: number): Promise<{ data: SupplierInvoiceRow }> =>
    (await apiClient.patch(`/api/finance/payables/${id}/approve`)).data,

  createReceivable: async (payload: {
    salesOrderId?: number;
    accountId?: number;
    currencyCode?: string;
    invoiceDate?: string;
    dueDate?: string;
    subtotal?: string;
    taxAmount?: string;
    notes?: string;
  }): Promise<{ data: CustomerInvoiceRow }> =>
    (await apiClient.post("/api/finance/receivables", payload)).data,

  payments: async (params?: {
    direction?: "OUTGOING" | "INCOMING";
  }): Promise<{ data: PaymentRow[] }> =>
    (await apiClient.get("/api/finance/payments", { params })).data,

  recordPayment: async (payload: {
    direction: "OUTGOING" | "INCOMING";
    method?: string;
    reference?: string;
    paymentDate?: string;
    currencyCode?: string;
    amount: string;
    supplierId?: number;
    accountId?: number;
    notes?: string;
    allocations: {
      supplierInvoiceId?: number;
      customerInvoiceId?: number;
      amount: string;
    }[];
  }): Promise<{ data: PaymentRow }> =>
    (await apiClient.post("/api/finance/payments", payload)).data,
};

export type WorkCenterRow = {
  id: number;
  code: string;
  name: string;
  type: string;
  description: string | null;
  capacityMinutesPerDay: number;
  efficiencyPercent: string;
  costPerHour: string;
  parallelCapacity: number;
  isActive: boolean;
  effectiveMinutesPerDay: number;
  warehouse: { id: number; code: string; name: string };
  _count: { operations: number; scheduled: number };
};

export type CapacityDay = {
  date: string;
  minutes: number;
  utilisationPercent: number;
  overloaded: boolean;
};

export type CapacityRow = {
  workCenter: {
    id: number;
    code: string;
    name: string;
    type: string;
    warehouse: string;
  };
  capacityMinutesPerDay: number;
  days: CapacityDay[];
  committedMinutes: number;
  availableMinutes: number;
  utilisationPercent: number;
  overloadedDays: number;
};

export type CapacityLoad = {
  from: string;
  to: string;
  days: string[];
  workCenters: CapacityRow[];
  scheduledOperations: number;
  overloadedCentres: number;
};

export type PlannedOperation = {
  id: number;
  sequence: number;
  name: string;
  status: string;
  plannedMinutes: number;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  workCenter: { code: string; name: string };
};

export type BomOperationRow = {
  id: number;
  bomId: number;
  sequence: number;
  name: string;
  description: string | null;
  setupMinutes: number;
  runMinutesPerUnit: string;
  isBlocking: boolean;
  workCenter: { id: number; code: string; name: string; costPerHour: string };
};

export type BomOperationPayload = {
  workCenterId: number;
  name: string;
  description?: string;
  sequence?: number;
  setupMinutes?: number;
  runMinutesPerUnit?: string;
  isBlocking?: boolean;
};

export type PlanningBoardRow = {
  id: number;
  orderNumber: string;
  status: string;
  plannedQuantity: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  isScheduled: boolean;
  canSchedule: boolean;
  totalMinutes: number;
  totalHours: number;
  product: { id: number; code: string; name: string };
  warehouse: { code: string };
  bom: { id: number; bomNumber: string } | null;
  operations: PlannedOperation[];
};

export const planningService = {
  board: async (): Promise<{ data: PlanningBoardRow[] }> =>
    (await apiClient.get("/api/planning/board")).data,

  capacity: async (params?: {
    days?: number;
    warehouseId?: number;
  }): Promise<{ data: CapacityLoad }> =>
    (await apiClient.get("/api/planning/capacity", { params })).data,

  workCenters: async (params?: {
    warehouseId?: number;
    activeOnly?: boolean;
  }): Promise<{ data: WorkCenterRow[] }> =>
    (await apiClient.get("/api/planning/work-centers", { params })).data,

  createWorkCenter: async (payload: {
    code: string;
    name: string;
    warehouseId: number;
    type?: string;
    description?: string;
    capacityMinutesPerDay?: number;
    efficiencyPercent?: string;
    costPerHour?: string;
    parallelCapacity?: number;
  }): Promise<{ data: WorkCenterRow }> =>
    (await apiClient.post("/api/planning/work-centers", payload)).data,

  bomOperations: async (bomId: number): Promise<{ data: BomOperationRow[] }> =>
    (await apiClient.get(`/api/planning/boms/${bomId}/operations`)).data,

  addBomOperation: async (
    bomId: number,
    payload: BomOperationPayload
  ): Promise<{ data: BomOperationRow }> =>
    (await apiClient.post(`/api/planning/boms/${bomId}/operations`, payload))
      .data,

  updateBomOperation: async (
    bomId: number,
    operationId: number,
    payload: Partial<BomOperationPayload>
  ): Promise<{ data: BomOperationRow }> =>
    (
      await apiClient.patch(
        `/api/planning/boms/${bomId}/operations/${operationId}`,
        payload
      )
    ).data,

  deleteBomOperation: async (
    bomId: number,
    operationId: number
  ): Promise<{ data: { id: number; name: string } }> =>
    (
      await apiClient.delete(
        `/api/planning/boms/${bomId}/operations/${operationId}`
      )
    ).data,

  scheduleOrder: async (
    id: number
  ): Promise<{
    data: {
      orderNumber: string;
      operations: PlannedOperation[];
      totalMinutes: number;
    };
  }> => (await apiClient.post(`/api/planning/orders/${id}/schedule`)).data,

  orderOperations: async (id: number): Promise<{ data: PlannedOperation[] }> =>
    (await apiClient.get(`/api/planning/orders/${id}/operations`)).data,
};
