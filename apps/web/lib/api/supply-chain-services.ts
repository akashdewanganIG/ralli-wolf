import apiClient from "./client";
import type {
  AlertEvaluationSummary,
  AvailabilityResult,
  BomChangeLogEntry,
  BomCostRollup,
  BomDetail,
  BomExplosion,
  BomSummary,
  ConsumptionReport,
  DeliveryWatchlistRow,
  GoodsReceipt,
  InventoryDashboard,
  InventoryValuation,
  MaterialRequisition,
  MaterialRow,
  Paginated,
  PackageRecord,
  Pallet,
  PickList,
  PriceComparisonRow,
  ProductStockDetail,
  ProductionOrder,
  ProductionVariance,
  PurchaseOrder,
  PurchaseRequisition,
  PurchasingDashboard,
  PutawaySuggestion,
  PutawayTask,
  QualityCheck,
  ReorderRule,
  ShortageRow,
  StockAlert,
  StockCount,
  StockLot,
  StockMovement,
  StockPositionRow,
  StorageBin,
  StorageUtilisation,
  Supplier,
  ProductImage,
  GoodsReceiptImage,
  QualityCheckImage,
  SupplierCatalogueEntry,
  SupplierContact,
  SupplierPerformanceSnapshot,
  SupplierScorecard,
  UnitOfMeasure,
  Warehouse,
  WarehouseImage,
  WarehouseZone,
  WhereUsedResult,
  Wrapped,
} from "./types/supply-chain";

type Params = Record<string, unknown> | undefined;

function clean(params: Params): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export const warehouseService = {
  list: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }): Promise<Paginated<Warehouse>> =>
    (await apiClient.get("/api/warehouses", { params: clean(params) })).data,

  getById: async (id: number): Promise<Wrapped<Warehouse>> =>
    (await apiClient.get(`/api/warehouses/${id}`)).data,

  create: async ({
    payload,
    images = [],
  }: {
    payload: Record<string, unknown>;
    images?: File[];
  }): Promise<Wrapped<Warehouse>> => {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null)
        formData.append(key, String(value));
    });
    images.forEach(image => formData.append("images", image));
    return (await apiClient.post("/api/warehouses", formData)).data;
  },

  update: async (
    id: number,
    payload: Partial<Warehouse>
  ): Promise<Wrapped<Warehouse>> =>
    (await apiClient.put(`/api/warehouses/${id}`, payload)).data,

  addImages: async (
    warehouseId: number,
    images: File[]
  ): Promise<Wrapped<WarehouseImage[]>> => {
    const formData = new FormData();
    images.forEach(image => formData.append("images", image));
    return (
      await apiClient.post(`/api/warehouses/${warehouseId}/images`, formData)
    ).data;
  },

  deleteImage: async (imageId: number): Promise<void> => {
    await apiClient.delete(`/api/warehouses/images/${imageId}`);
  },

  listZones: async (warehouseId: number): Promise<Wrapped<WarehouseZone[]>> =>
    (await apiClient.get(`/api/warehouses/${warehouseId}/zones`)).data,

  createZone: async (
    warehouseId: number,
    payload: Partial<WarehouseZone>
  ): Promise<Wrapped<WarehouseZone>> =>
    (await apiClient.post(`/api/warehouses/${warehouseId}/zones`, payload))
      .data,

  listBins: async (
    warehouseId: number,
    params?: {
      page?: number;
      limit?: number;
      zoneId?: number;
      search?: string;
      onlyEmpty?: boolean;
    }
  ): Promise<Paginated<StorageBin>> =>
    (
      await apiClient.get(`/api/warehouses/${warehouseId}/bins`, {
        params: clean(params),
      })
    ).data,

  createBin: async (
    warehouseId: number,
    payload: Record<string, unknown>
  ): Promise<Wrapped<StorageBin>> =>
    (await apiClient.post(`/api/warehouses/${warehouseId}/bins`, payload)).data,

  generateBins: async (
    warehouseId: number,
    payload: {
      zoneId: number;
      aisles: number;
      racksPerAisle: number;
      levelsPerRack: number;
      positionsPerLevel?: number;
      binType?: string;
      prefix?: string;
      pickFaceLevel?: string;
    }
  ): Promise<
    Wrapped<{ requested: number; created: number; skippedExisting: number }>
  > =>
    (await apiClient.post(`/api/warehouses/${warehouseId}/bins/bulk`, payload))
      .data,

  updateBin: async (
    binId: number,
    payload: Record<string, unknown>
  ): Promise<Wrapped<StorageBin>> =>
    (await apiClient.put(`/api/warehouses/bins/${binId}`, payload)).data,

  utilisation: async (
    warehouseId: number
  ): Promise<Wrapped<StorageUtilisation>> =>
    (await apiClient.get(`/api/warehouses/${warehouseId}/utilisation`)).data,

  listPallets: async (
    warehouseId: number,
    params?: { page?: number; limit?: number; status?: string }
  ): Promise<Paginated<Pallet>> =>
    (
      await apiClient.get(`/api/warehouses/${warehouseId}/pallets`, {
        params: clean(params),
      })
    ).data,

  createPallet: async (
    warehouseId: number,
    payload: Record<string, unknown>
  ): Promise<Wrapped<Pallet>> =>
    (await apiClient.post(`/api/warehouses/${warehouseId}/pallets`, payload))
      .data,

  movePallet: async (
    palletId: number,
    toBinId: number
  ): Promise<Wrapped<Pallet>> =>
    (
      await apiClient.patch(`/api/warehouses/pallets/${palletId}/move`, {
        toBinId,
      })
    ).data,
};

export const inventoryService = {
  dashboard: async (params?: {
    warehouseId?: number;
    from?: string;
    to?: string;
  }): Promise<Wrapped<InventoryDashboard>> =>
    (await apiClient.get("/api/inventory/dashboard", { params: clean(params) }))
      .data,

  valuation: async (params?: {
    warehouseId?: number;
    itemType?: string;
  }): Promise<Wrapped<InventoryValuation>> =>
    (await apiClient.get("/api/inventory/valuation", { params: clean(params) }))
      .data,

  units: async (): Promise<Wrapped<UnitOfMeasure[]>> =>
    (await apiClient.get("/api/inventory/units")).data,

  listStock: async (params?: {
    page?: number;
    limit?: number;
    warehouseId?: number;
    search?: string;
    itemType?: string;
    belowReorder?: boolean;
  }): Promise<Paginated<StockPositionRow>> =>
    (await apiClient.get("/api/inventory/stock", { params: clean(params) }))
      .data,

  productStock: async (
    productId: number,
    params?: { warehouseId?: number }
  ): Promise<Wrapped<ProductStockDetail>> =>
    (
      await apiClient.get(`/api/inventory/stock/${productId}`, {
        params: clean(params),
      })
    ).data,

  listMovements: async (params?: {
    page?: number;
    limit?: number;
    productId?: number;
    warehouseId?: number;
    lotId?: number;
    movementType?: string;
    direction?: string;
    referenceType?: string;
    from?: string;
    to?: string;
  }): Promise<Paginated<StockMovement>> =>
    (await apiClient.get("/api/inventory/movements", { params: clean(params) }))
      .data,

  listLots: async (params?: {
    page?: number;
    limit?: number;
    productId?: number;
    search?: string;
    expiringWithinDays?: number;
    onlyInStock?: boolean;
  }): Promise<Paginated<StockLot>> =>
    (await apiClient.get("/api/inventory/lots", { params: clean(params) }))
      .data,

  createReceipt: async (
    payload: Record<string, unknown>
  ): Promise<Wrapped<unknown>> =>
    (await apiClient.post("/api/inventory/receipts", payload)).data,

  createAdjustment: async (
    payload: Record<string, unknown>
  ): Promise<Wrapped<unknown>> =>
    (await apiClient.post("/api/inventory/adjustments", payload)).data,

  createTransfer: async (
    payload: Record<string, unknown>
  ): Promise<Wrapped<unknown>> =>
    (await apiClient.post("/api/inventory/transfers", payload)).data,

  listAlerts: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    severity?: string;
    alertType?: string;
    warehouseId?: number;
  }): Promise<Paginated<StockAlert> & { summary: Record<string, number> }> =>
    (await apiClient.get("/api/inventory/alerts", { params: clean(params) }))
      .data,

  evaluateAlerts: async (payload?: {
    warehouseId?: number;
    notify?: boolean;
  }): Promise<Wrapped<AlertEvaluationSummary>> =>
    (await apiClient.post("/api/inventory/alerts/evaluate", payload ?? {}))
      .data,

  acknowledgeAlert: async (
    id: number,
    note?: string
  ): Promise<Wrapped<StockAlert>> =>
    (await apiClient.patch(`/api/inventory/alerts/${id}/acknowledge`, { note }))
      .data,

  resolveAlert: async (
    id: number,
    note?: string
  ): Promise<Wrapped<StockAlert>> =>
    (await apiClient.patch(`/api/inventory/alerts/${id}/resolve`, { note }))
      .data,

  listReorderRules: async (params?: {
    page?: number;
    limit?: number;
    warehouseId?: number;
    productId?: number;
  }): Promise<Paginated<ReorderRule>> =>
    (
      await apiClient.get("/api/inventory/reorder-rules", {
        params: clean(params),
      })
    ).data,

  saveReorderRule: async (
    payload: Record<string, unknown>
  ): Promise<Wrapped<ReorderRule>> =>
    (await apiClient.put("/api/inventory/reorder-rules", payload)).data,

  deleteReorderRule: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/inventory/reorder-rules/${id}`);
  },

  listCounts: async (params?: {
    page?: number;
    limit?: number;
    warehouseId?: number;
    status?: string;
  }): Promise<Paginated<StockCount>> =>
    (await apiClient.get("/api/inventory/counts", { params: clean(params) }))
      .data,

  createCount: async (
    payload: Record<string, unknown>
  ): Promise<Wrapped<StockCount>> =>
    (await apiClient.post("/api/inventory/counts", payload)).data,

  getCount: async (id: number): Promise<Wrapped<StockCount>> =>
    (await apiClient.get(`/api/inventory/counts/${id}`)).data,

  recordCountLines: async (
    id: number,
    lines: Array<{
      lineId: number;
      countedQuantity: string;
      reasonCode?: string;
      notes?: string;
    }>
  ): Promise<Wrapped<StockCount>> =>
    (await apiClient.patch(`/api/inventory/counts/${id}/lines`, { lines }))
      .data,

  postCount: async (
    id: number,
    reasonCode?: string
  ): Promise<Wrapped<unknown>> =>
    (await apiClient.post(`/api/inventory/counts/${id}/post`, { reasonCode }))
      .data,
};

export const materialService = {
  list: async (params?: {
    page?: number;
    limit?: number;
    warehouseId?: number;
    search?: string;
    itemType?: string;
  }): Promise<Paginated<MaterialRow>> =>
    (await apiClient.get("/api/materials", { params: clean(params) })).data,

  availability: async (payload: {
    productId: number;
    bomId?: number;
    quantity: string | number;
    warehouseId?: number;
    includeSubstitutes?: boolean;
  }): Promise<Wrapped<AvailabilityResult>> =>
    (await apiClient.post("/api/materials/availability", payload)).data,

  consumption: async (params?: {
    from?: string;
    to?: string;
    warehouseId?: number;
    itemType?: string;
  }): Promise<Wrapped<ConsumptionReport>> =>
    (
      await apiClient.get("/api/materials/consumption", {
        params: clean(params),
      })
    ).data,

  shortages: async (params?: {
    warehouseId?: number;
  }): Promise<
    Wrapped<{
      totalShortages: number;
      criticalShortages: number;
      rows: ShortageRow[];
    }>
  > =>
    (await apiClient.get("/api/materials/shortages", { params: clean(params) }))
      .data,

  listRequisitions: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    warehouseId?: number;
  }): Promise<Paginated<MaterialRequisition>> =>
    (
      await apiClient.get("/api/materials/requisitions", {
        params: clean(params),
      })
    ).data,

  getRequisition: async (id: number): Promise<Wrapped<MaterialRequisition>> =>
    (await apiClient.get(`/api/materials/requisitions/${id}`)).data,

  createRequisition: async (
    payload: Record<string, unknown>
  ): Promise<Wrapped<MaterialRequisition>> =>
    (await apiClient.post("/api/materials/requisitions", payload)).data,

  issueRequisition: async (
    id: number,
    payload?: Record<string, unknown>
  ): Promise<Wrapped<unknown>> =>
    (
      await apiClient.post(
        `/api/materials/requisitions/${id}/issue`,
        payload ?? {}
      )
    ).data,

  cancelRequisition: async (
    id: number
  ): Promise<Wrapped<MaterialRequisition>> =>
    (await apiClient.patch(`/api/materials/requisitions/${id}/cancel`, {}))
      .data,
};

export const wmsService = {
  dashboard: async (params?: {
    warehouseId?: number;
  }): Promise<Wrapped<import("./types/supply-chain").WmsDashboard>> =>
    (await apiClient.get("/api/wms/dashboard", { params: clean(params) })).data,

  putawaySuggestions: async (params: {
    productId: number;
    warehouseId: number;
    quantity: string | number;
    limit?: number;
  }): Promise<Wrapped<PutawaySuggestion[]>> =>
    (
      await apiClient.get("/api/wms/putaway-suggestions", {
        params: clean(params),
      })
    ).data,

  listPutawayTasks: async (params?: {
    page?: number;
    limit?: number;
    warehouseId?: number;
    status?: string;
    assignedToId?: number;
  }): Promise<Paginated<PutawayTask>> =>
    (await apiClient.get("/api/wms/putaway-tasks", { params: clean(params) }))
      .data,

  assignPutawayTask: async (
    id: number,
    assignedToId: number
  ): Promise<Wrapped<PutawayTask>> =>
    (
      await apiClient.patch(`/api/wms/putaway-tasks/${id}/assign`, {
        assignedToId,
      })
    ).data,

  completePutaway: async (
    id: number,
    payload?: { toBinId?: number; quantity?: string }
  ): Promise<Wrapped<PutawayTask>> =>
    (
      await apiClient.post(
        `/api/wms/putaway-tasks/${id}/complete`,
        payload ?? {}
      )
    ).data,

  listPickLists: async (params?: {
    page?: number;
    limit?: number;
    warehouseId?: number;
    status?: string;
  }): Promise<Paginated<PickList>> =>
    (await apiClient.get("/api/wms/pick-lists", { params: clean(params) }))
      .data,

  getPickList: async (id: number): Promise<Wrapped<PickList>> =>
    (await apiClient.get(`/api/wms/pick-lists/${id}`)).data,

  createPickList: async (
    payload: Record<string, unknown>
  ): Promise<Wrapped<PickList>> =>
    (await apiClient.post("/api/wms/pick-lists", payload)).data,

  releasePickList: async (id: number): Promise<Wrapped<PickList>> =>
    (await apiClient.patch(`/api/wms/pick-lists/${id}/release`, {})).data,

  cancelPickList: async (id: number): Promise<Wrapped<PickList>> =>
    (await apiClient.patch(`/api/wms/pick-lists/${id}/cancel`, {})).data,

  confirmPick: async (
    pickTaskId: number,
    payload?: { quantity?: string; notes?: string }
  ): Promise<Wrapped<unknown>> =>
    (
      await apiClient.post(
        `/api/wms/pick-tasks/${pickTaskId}/confirm`,
        payload ?? {}
      )
    ).data,

  createPackage: async (
    pickListId: number,
    payload: Record<string, unknown>
  ): Promise<Wrapped<PackageRecord>> =>
    (
      await apiClient.post(
        `/api/wms/pick-lists/${pickListId}/packages`,
        payload
      )
    ).data,

  ship: async (
    pickListId: number,
    packageIds: number[]
  ): Promise<Wrapped<unknown>> =>
    (
      await apiClient.post(`/api/wms/pick-lists/${pickListId}/ship`, {
        packageIds,
      })
    ).data,

  listPackages: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    pickListId?: number;
  }): Promise<Paginated<PackageRecord>> =>
    (await apiClient.get("/api/wms/packages", { params: clean(params) })).data,
};

export const bomService = {
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    productId?: number;
    search?: string;
  }): Promise<Paginated<BomSummary>> =>
    (await apiClient.get("/api/boms", { params: clean(params) })).data,

  getById: async (id: number): Promise<Wrapped<BomDetail>> =>
    (await apiClient.get(`/api/boms/${id}`)).data,

  create: async (
    payload: Record<string, unknown>
  ): Promise<Wrapped<BomSummary>> =>
    (await apiClient.post("/api/boms", payload)).data,

  update: async (
    id: number,
    payload: Record<string, unknown>
  ): Promise<Wrapped<BomSummary>> =>
    (await apiClient.put(`/api/boms/${id}`, payload)).data,

  changeStatus: async (
    id: number,
    status: string,
    reason?: string
  ): Promise<Wrapped<BomSummary>> =>
    (await apiClient.patch(`/api/boms/${id}/status`, { status, reason })).data,

  addComponent: async (
    bomId: number,
    payload: Record<string, unknown>
  ): Promise<Wrapped<unknown>> =>
    (await apiClient.post(`/api/boms/${bomId}/components`, payload)).data,

  replaceComponents: async (
    bomId: number,
    components: Array<Record<string, unknown>>,
    reason?: string
  ): Promise<Wrapped<BomDetail>> =>
    (
      await apiClient.post(`/api/boms/${bomId}/components/bulk`, {
        components,
        reason,
      })
    ).data,

  updateComponent: async (
    componentId: number,
    payload: Record<string, unknown>
  ): Promise<Wrapped<unknown>> =>
    (await apiClient.put(`/api/boms/components/${componentId}`, payload)).data,

  removeComponent: async (componentId: number): Promise<void> => {
    await apiClient.delete(`/api/boms/components/${componentId}`);
  },

  addSubstitute: async (
    componentId: number,
    payload: Record<string, unknown>
  ): Promise<Wrapped<unknown>> =>
    (
      await apiClient.post(
        `/api/boms/components/${componentId}/substitutes`,
        payload
      )
    ).data,

  removeSubstitute: async (substituteId: number): Promise<void> => {
    await apiClient.delete(`/api/boms/substitutes/${substituteId}`);
  },

  explode: async (
    id: number,
    params?: { quantity?: string | number; maxLevels?: number }
  ): Promise<Wrapped<BomExplosion>> =>
    (await apiClient.get(`/api/boms/${id}/explode`, { params: clean(params) }))
      .data,

  costRollup: async (
    id: number,
    persist = true
  ): Promise<Wrapped<BomCostRollup>> =>
    (await apiClient.post(`/api/boms/${id}/cost-rollup`, { persist })).data,

  whereUsed: async (productId: number): Promise<Wrapped<WhereUsedResult>> =>
    (await apiClient.get(`/api/boms/where-used/${productId}`)).data,

  revise: async (
    id: number,
    payload?: { reason?: string; revision?: string }
  ): Promise<Wrapped<BomSummary>> =>
    (await apiClient.post(`/api/boms/${id}/revise`, payload ?? {})).data,

  history: async (
    id: number,
    params?: { page?: number; limit?: number }
  ): Promise<Paginated<BomChangeLogEntry>> =>
    (await apiClient.get(`/api/boms/${id}/history`, { params: clean(params) }))
      .data,
};

export const supplierService = {
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<Paginated<Supplier>> =>
    (await apiClient.get("/api/suppliers", { params: clean(params) })).data,

  getById: async (id: number): Promise<Wrapped<Supplier>> =>
    (await apiClient.get(`/api/suppliers/${id}`)).data,

  create: async (
    payload: Record<string, unknown>
  ): Promise<Wrapped<Supplier>> =>
    (await apiClient.post("/api/suppliers", payload)).data,

  update: async (
    id: number,
    payload: Record<string, unknown>
  ): Promise<Wrapped<Supplier>> =>
    (await apiClient.put(`/api/suppliers/${id}`, payload)).data,

  addContact: async (
    supplierId: number,
    payload: Record<string, unknown>
  ): Promise<Wrapped<SupplierContact>> =>
    (await apiClient.post(`/api/suppliers/${supplierId}/contacts`, payload))
      .data,

  removeContact: async (contactId: number): Promise<void> => {
    await apiClient.delete(`/api/suppliers/contacts/${contactId}`);
  },

  listCatalogue: async (
    supplierId: number,
    params?: { page?: number; limit?: number; activeOnly?: boolean }
  ): Promise<Paginated<SupplierCatalogueEntry>> =>
    (
      await apiClient.get(`/api/suppliers/${supplierId}/catalogue`, {
        params: clean(params),
      })
    ).data,

  saveCataloguePrice: async (
    supplierId: number,
    payload: Record<string, unknown>
  ): Promise<Wrapped<SupplierCatalogueEntry>> =>
    (await apiClient.post(`/api/suppliers/${supplierId}/catalogue`, payload))
      .data,

  removeCatalogueEntry: async (entryId: number): Promise<void> => {
    await apiClient.delete(`/api/suppliers/catalogue/${entryId}`);
  },

  priceComparison: async (
    productId: number,
    quantity: string | number = 1
  ): Promise<
    Wrapped<{
      productId: number;
      quantity: string;
      suppliers: PriceComparisonRow[];
    }>
  > =>
    (
      await apiClient.get(`/api/suppliers/price-comparison/${productId}`, {
        params: { quantity },
      })
    ).data,

  performance: async (
    id: number,
    params?: { from?: string; to?: string }
  ): Promise<
    Wrapped<{
      scorecard: SupplierScorecard;
      history: SupplierPerformanceSnapshot[];
      weights: Record<string, number>;
    }>
  > =>
    (
      await apiClient.get(`/api/suppliers/${id}/performance`, {
        params: clean(params),
      })
    ).data,

  snapshotPerformance: async (
    id: number,
    params?: { from?: string; to?: string }
  ): Promise<Wrapped<SupplierPerformanceSnapshot>> =>
    (
      await apiClient.post(
        `/api/suppliers/${id}/performance/snapshot`,
        {},
        { params: clean(params) }
      )
    ).data,

  scorecards: async (params?: {
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<
    Wrapped<{
      period: { from: string; to: string };
      weights: Record<string, number>;
      suppliers: SupplierScorecard[];
    }>
  > =>
    (
      await apiClient.get("/api/suppliers/scorecards", {
        params: clean(params),
      })
    ).data,

  deliveryWatchlist: async (params?: {
    warehouseId?: number;
    daysAhead?: number;
  }): Promise<
    Wrapped<{ total: number; overdue: number; rows: DeliveryWatchlistRow[] }>
  > =>
    (
      await apiClient.get("/api/suppliers/delivery-watchlist", {
        params: clean(params),
      })
    ).data,
};

export const purchaseRequisitionService = {
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    warehouseId?: number;
    origin?: string;
  }): Promise<Paginated<PurchaseRequisition>> =>
    (
      await apiClient.get("/api/purchase-requisitions", {
        params: clean(params),
      })
    ).data,

  getById: async (id: number): Promise<Wrapped<PurchaseRequisition>> =>
    (await apiClient.get(`/api/purchase-requisitions/${id}`)).data,

  create: async (
    payload: Record<string, unknown>
  ): Promise<Wrapped<PurchaseRequisition>> =>
    (await apiClient.post("/api/purchase-requisitions", payload)).data,

  setStatus: async (
    id: number,
    status: string,
    reason?: string
  ): Promise<Wrapped<PurchaseRequisition>> =>
    (
      await apiClient.patch(`/api/purchase-requisitions/${id}/status`, {
        status,
        reason,
      })
    ).data,

  convert: async (
    id: number,
    payload: Record<string, unknown>
  ): Promise<Wrapped<PurchaseOrder>> =>
    (await apiClient.post(`/api/purchase-requisitions/${id}/convert`, payload))
      .data,
};

export const purchaseOrderService = {
  dashboard: async (params?: {
    warehouseId?: number;
  }): Promise<Wrapped<PurchasingDashboard>> =>
    (
      await apiClient.get("/api/purchase-orders/dashboard", {
        params: clean(params),
      })
    ).data,

  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    supplierId?: number;
    warehouseId?: number;
    search?: string;
  }): Promise<Paginated<PurchaseOrder>> =>
    (await apiClient.get("/api/purchase-orders", { params: clean(params) }))
      .data,

  getById: async (id: number): Promise<Wrapped<PurchaseOrder>> =>
    (await apiClient.get(`/api/purchase-orders/${id}`)).data,

  create: async (
    payload: Record<string, unknown>
  ): Promise<Wrapped<PurchaseOrder>> =>
    (await apiClient.post("/api/purchase-orders", payload)).data,

  update: async (
    id: number,
    payload: Record<string, unknown>
  ): Promise<Wrapped<PurchaseOrder>> =>
    (await apiClient.put(`/api/purchase-orders/${id}`, payload)).data,

  submitForApproval: async (
    id: number,
    payload: { requestedToId: number; comment?: string }
  ): Promise<Wrapped<unknown>> =>
    (await apiClient.post(`/api/purchase-orders/${id}/submit`, payload)).data,

  setStatus: async (
    id: number,
    status: string,
    reason?: string
  ): Promise<Wrapped<PurchaseOrder>> =>
    (
      await apiClient.patch(`/api/purchase-orders/${id}/status`, {
        status,
        reason,
      })
    ).data,
};

export const goodsReceiptService = {
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    supplierId?: number;
    warehouseId?: number;
    purchaseOrderId?: number;
    search?: string;
  }): Promise<Paginated<GoodsReceipt>> =>
    (await apiClient.get("/api/goods-receipts", { params: clean(params) }))
      .data,

  getById: async (id: number): Promise<Wrapped<GoodsReceipt>> =>
    (await apiClient.get(`/api/goods-receipts/${id}`)).data,

  create: async (
    payload: Record<string, unknown>
  ): Promise<Wrapped<GoodsReceipt>> =>
    (await apiClient.post("/api/goods-receipts", payload)).data,

  post: async (
    id: number,
    createPutawayTasks = true
  ): Promise<Wrapped<unknown>> =>
    (
      await apiClient.post(`/api/goods-receipts/${id}/post`, {
        createPutawayTasks,
      })
    ).data,

  cancel: async (id: number, reason?: string): Promise<Wrapped<GoodsReceipt>> =>
    (await apiClient.patch(`/api/goods-receipts/${id}/cancel`, { reason }))
      .data,

  recordQualityCheck: async (
    grnLineId: number,
    payload: Record<string, unknown>
  ): Promise<Wrapped<QualityCheck>> =>
    (
      await apiClient.post(
        `/api/goods-receipts/lines/${grnLineId}/quality-check`,
        payload
      )
    ).data,

  listQualityChecks: async (params?: {
    page?: number;
    limit?: number;
    result?: string;
    supplierId?: number;
  }): Promise<Paginated<QualityCheck>> =>
    (
      await apiClient.get("/api/goods-receipts/quality-checks", {
        params: clean(params),
      })
    ).data,
};

export const productionOrderService = {
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    warehouseId?: number;
    productId?: number;
  }): Promise<Paginated<ProductionOrder>> =>
    (await apiClient.get("/api/production-orders", { params: clean(params) }))
      .data,

  getById: async (id: number): Promise<Wrapped<ProductionOrder>> =>
    (await apiClient.get(`/api/production-orders/${id}`)).data,

  create: async (
    payload: Record<string, unknown>
  ): Promise<Wrapped<ProductionOrder>> =>
    (await apiClient.post("/api/production-orders", payload)).data,

  availability: async (id: number): Promise<Wrapped<AvailabilityResult>> =>
    (await apiClient.get(`/api/production-orders/${id}/availability`)).data,

  release: async (
    id: number,
    reserveMaterials = true
  ): Promise<Wrapped<ProductionOrder>> =>
    (
      await apiClient.post(`/api/production-orders/${id}/release`, {
        reserveMaterials,
      })
    ).data,

  complete: async (
    id: number,
    payload: Record<string, unknown>
  ): Promise<Wrapped<unknown>> =>
    (await apiClient.post(`/api/production-orders/${id}/complete`, payload))
      .data,

  cancel: async (
    id: number,
    reason?: string
  ): Promise<Wrapped<ProductionOrder>> =>
    (await apiClient.patch(`/api/production-orders/${id}/cancel`, { reason }))
      .data,

  variance: async (id: number): Promise<Wrapped<ProductionVariance>> =>
    (await apiClient.get(`/api/production-orders/${id}/variance`)).data,
};

/**
 * Image collections share one transport shape across entities: multipart
 * upload under the "images" field, and delete by image id.
 */
export const entityImageService = {
  listProductImages: async (
    productId: number
  ): Promise<Wrapped<ProductImage[]>> =>
    (await apiClient.get(`/api/products/${productId}/images`)).data,

  addProductImages: async (
    productId: number,
    images: File[]
  ): Promise<Wrapped<ProductImage[]>> => {
    const formData = new FormData();
    images.forEach(image => formData.append("images", image));
    return (await apiClient.post(`/api/products/${productId}/images`, formData))
      .data;
  },

  deleteProductImage: async (imageId: number): Promise<void> => {
    await apiClient.delete(`/api/products/images/${imageId}`);
  },

  uploadSupplierLogo: async (
    supplierId: number,
    logo: File
  ): Promise<Wrapped<Supplier>> => {
    const formData = new FormData();
    formData.append("images", logo);
    return (await apiClient.post(`/api/suppliers/${supplierId}/logo`, formData))
      .data;
  },

  deleteSupplierLogo: async (supplierId: number): Promise<void> => {
    await apiClient.delete(`/api/suppliers/${supplierId}/logo`);
  },

  listReceiptImages: async (
    grnId: number
  ): Promise<Wrapped<GoodsReceiptImage[]>> =>
    (await apiClient.get(`/api/goods-receipts/${grnId}/images`)).data,

  addReceiptImages: async (
    grnId: number,
    images: File[],
    options: { grnLineId?: number; caption?: string } = {}
  ): Promise<Wrapped<GoodsReceiptImage[]>> => {
    const formData = new FormData();
    images.forEach(image => formData.append("images", image));
    if (options.grnLineId !== undefined)
      formData.append("grnLineId", String(options.grnLineId));
    if (options.caption) formData.append("caption", options.caption);
    return (
      await apiClient.post(`/api/goods-receipts/${grnId}/images`, formData)
    ).data;
  },

  deleteReceiptImage: async (imageId: number): Promise<void> => {
    await apiClient.delete(`/api/goods-receipts/images/${imageId}`);
  },

  listQualityCheckImages: async (
    qualityCheckId: number
  ): Promise<Wrapped<QualityCheckImage[]>> =>
    (
      await apiClient.get(
        `/api/goods-receipts/quality-checks/${qualityCheckId}/images`
      )
    ).data,

  addQualityCheckImages: async (
    qualityCheckId: number,
    images: File[],
    caption?: string
  ): Promise<Wrapped<QualityCheckImage[]>> => {
    const formData = new FormData();
    images.forEach(image => formData.append("images", image));
    if (caption) formData.append("caption", caption);
    return (
      await apiClient.post(
        `/api/goods-receipts/quality-checks/${qualityCheckId}/images`,
        formData
      )
    ).data;
  },

  deleteQualityCheckImage: async (imageId: number): Promise<void> => {
    await apiClient.delete(
      `/api/goods-receipts/quality-checks/images/${imageId}`
    );
  },
};
