"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bomService,
  goodsReceiptService,
  inventoryService,
  materialService,
  productionOrderService,
  purchaseOrderService,
  purchaseRequisitionService,
  supplierService,
  warehouseService,
  wmsService,
} from "../lib/api/supplyChainServices";

/**
 * Query keys for the supply-chain modules.
 *
 * Grouped by module so a mutation can invalidate everything a posting touches
 * with one call: a goods receipt, for instance, changes stock, movements,
 * alerts, putaway work and the purchase order all at once.
 */
export const supplyChainKeys = {
  warehouses: ["supply-chain", "warehouses"] as const,
  warehouse: (id: number) => ["supply-chain", "warehouses", id] as const,
  zones: (warehouseId: number) =>
    ["supply-chain", "warehouses", warehouseId, "zones"] as const,
  bins: (warehouseId: number, filters?: unknown) =>
    ["supply-chain", "warehouses", warehouseId, "bins", filters ?? {}] as const,
  utilisation: (warehouseId: number) =>
    ["supply-chain", "warehouses", warehouseId, "utilisation"] as const,
  pallets: (warehouseId: number, filters?: unknown) =>
    [
      "supply-chain",
      "warehouses",
      warehouseId,
      "pallets",
      filters ?? {},
    ] as const,

  inventory: ["supply-chain", "inventory"] as const,
  inventoryDashboard: (filters?: unknown) =>
    ["supply-chain", "inventory", "dashboard", filters ?? {}] as const,
  stock: (filters?: unknown) =>
    ["supply-chain", "inventory", "stock", filters ?? {}] as const,
  productStock: (productId: number, filters?: unknown) =>
    ["supply-chain", "inventory", "stock", productId, filters ?? {}] as const,
  movements: (filters?: unknown) =>
    ["supply-chain", "inventory", "movements", filters ?? {}] as const,
  lots: (filters?: unknown) =>
    ["supply-chain", "inventory", "lots", filters ?? {}] as const,
  alerts: (filters?: unknown) =>
    ["supply-chain", "inventory", "alerts", filters ?? {}] as const,
  reorderRules: (filters?: unknown) =>
    ["supply-chain", "inventory", "reorder-rules", filters ?? {}] as const,
  valuation: (filters?: unknown) =>
    ["supply-chain", "inventory", "valuation", filters ?? {}] as const,
  counts: (filters?: unknown) =>
    ["supply-chain", "inventory", "counts", filters ?? {}] as const,
  count: (id: number) => ["supply-chain", "inventory", "counts", id] as const,
  units: ["supply-chain", "inventory", "units"] as const,

  materials: (filters?: unknown) =>
    ["supply-chain", "materials", filters ?? {}] as const,
  materialShortages: (filters?: unknown) =>
    ["supply-chain", "materials", "shortages", filters ?? {}] as const,
  consumption: (filters?: unknown) =>
    ["supply-chain", "materials", "consumption", filters ?? {}] as const,
  materialRequisitions: (filters?: unknown) =>
    ["supply-chain", "materials", "requisitions", filters ?? {}] as const,
  materialRequisition: (id: number) =>
    ["supply-chain", "materials", "requisitions", id] as const,

  wms: ["supply-chain", "wms"] as const,
  wmsDashboard: (filters?: unknown) =>
    ["supply-chain", "wms", "dashboard", filters ?? {}] as const,
  putawayTasks: (filters?: unknown) =>
    ["supply-chain", "wms", "putaway", filters ?? {}] as const,
  pickLists: (filters?: unknown) =>
    ["supply-chain", "wms", "pick-lists", filters ?? {}] as const,
  pickList: (id: number) => ["supply-chain", "wms", "pick-lists", id] as const,
  packages: (filters?: unknown) =>
    ["supply-chain", "wms", "packages", filters ?? {}] as const,

  boms: (filters?: unknown) => ["supply-chain", "boms", filters ?? {}] as const,
  bom: (id: number) => ["supply-chain", "boms", id] as const,
  bomExplosion: (id: number, quantity: string | number) =>
    ["supply-chain", "boms", id, "explode", quantity] as const,
  bomHistory: (id: number) => ["supply-chain", "boms", id, "history"] as const,
  whereUsed: (productId: number) =>
    ["supply-chain", "boms", "where-used", productId] as const,

  suppliers: (filters?: unknown) =>
    ["supply-chain", "suppliers", filters ?? {}] as const,
  supplier: (id: number) => ["supply-chain", "suppliers", id] as const,
  supplierCatalogue: (id: number, filters?: unknown) =>
    ["supply-chain", "suppliers", id, "catalogue", filters ?? {}] as const,
  supplierPerformance: (id: number, filters?: unknown) =>
    ["supply-chain", "suppliers", id, "performance", filters ?? {}] as const,
  scorecards: (filters?: unknown) =>
    ["supply-chain", "suppliers", "scorecards", filters ?? {}] as const,
  deliveryWatchlist: (filters?: unknown) =>
    ["supply-chain", "suppliers", "watchlist", filters ?? {}] as const,
  priceComparison: (productId: number, quantity: string | number) =>
    [
      "supply-chain",
      "suppliers",
      "price-comparison",
      productId,
      quantity,
    ] as const,

  requisitions: (filters?: unknown) =>
    ["supply-chain", "purchase-requisitions", filters ?? {}] as const,
  requisition: (id: number) =>
    ["supply-chain", "purchase-requisitions", id] as const,
  purchaseOrders: (filters?: unknown) =>
    ["supply-chain", "purchase-orders", filters ?? {}] as const,
  purchaseOrder: (id: number) =>
    ["supply-chain", "purchase-orders", id] as const,
  purchasingDashboard: (filters?: unknown) =>
    ["supply-chain", "purchase-orders", "dashboard", filters ?? {}] as const,

  goodsReceipts: (filters?: unknown) =>
    ["supply-chain", "goods-receipts", filters ?? {}] as const,
  goodsReceipt: (id: number) => ["supply-chain", "goods-receipts", id] as const,
  qualityChecks: (filters?: unknown) =>
    [
      "supply-chain",
      "goods-receipts",
      "quality-checks",
      filters ?? {},
    ] as const,

  productionOrders: (filters?: unknown) =>
    ["supply-chain", "production-orders", filters ?? {}] as const,
  productionOrder: (id: number) =>
    ["supply-chain", "production-orders", id] as const,
  productionVariance: (id: number) =>
    ["supply-chain", "production-orders", id, "variance"] as const,
};

/** Stock figures change constantly, so they are refetched rather than trusted for long. */
const LIVE_STALE_TIME = 30 * 1000;
/** Master data changes rarely. */
const MASTER_STALE_TIME = 5 * 60 * 1000;

// ------------------------------------------------------------- warehouses

export function useWarehouses(filters?: {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}) {
  const query = useQuery({
    queryKey: [...supplyChainKeys.warehouses, filters ?? {}],
    queryFn: () => warehouseService.list(filters),
    staleTime: MASTER_STALE_TIME,
  });
  return {
    ...query,
    warehouses: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useWarehouse(id: number) {
  return useQuery({
    queryKey: supplyChainKeys.warehouse(id),
    queryFn: () => warehouseService.getById(id),
    enabled: !!id,
    staleTime: MASTER_STALE_TIME,
  });
}

export function useWarehouseZones(warehouseId: number) {
  return useQuery({
    queryKey: supplyChainKeys.zones(warehouseId),
    queryFn: () => warehouseService.listZones(warehouseId),
    enabled: !!warehouseId,
    staleTime: MASTER_STALE_TIME,
  });
}

export function useStorageBins(
  warehouseId: number,
  filters?: {
    page?: number;
    limit?: number;
    zoneId?: number;
    search?: string;
    onlyEmpty?: boolean;
  }
) {
  const query = useQuery({
    queryKey: supplyChainKeys.bins(warehouseId, filters),
    queryFn: () => warehouseService.listBins(warehouseId, filters),
    enabled: !!warehouseId,
    staleTime: MASTER_STALE_TIME,
  });
  return {
    ...query,
    bins: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useStorageUtilisation(warehouseId: number) {
  return useQuery({
    queryKey: supplyChainKeys.utilisation(warehouseId),
    queryFn: () => warehouseService.utilisation(warehouseId),
    enabled: !!warehouseId,
    staleTime: LIVE_STALE_TIME,
  });
}

export function usePallets(
  warehouseId: number,
  filters?: { page?: number; limit?: number; status?: string }
) {
  const query = useQuery({
    queryKey: supplyChainKeys.pallets(warehouseId, filters),
    queryFn: () => warehouseService.listPallets(warehouseId, filters),
    enabled: !!warehouseId,
    staleTime: LIVE_STALE_TIME,
  });
  return {
    ...query,
    pallets: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useWarehouseMutations() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: supplyChainKeys.warehouses });

  return {
    create: useMutation({
      meta: { successMessage: "Warehouse created" },
      mutationFn: warehouseService.create,
      onSuccess: invalidate,
    }),
    update: useMutation({
      meta: { successMessage: "Warehouse updated" },
      mutationFn: ({
        id,
        payload,
      }: {
        id: number;
        payload: Record<string, unknown>;
      }) => warehouseService.update(id, payload),
      onSuccess: invalidate,
    }),
    addImages: useMutation({
      meta: { successMessage: "Warehouse images uploaded" },
      mutationFn: ({
        warehouseId,
        images,
      }: {
        warehouseId: number;
        images: File[];
      }) => warehouseService.addImages(warehouseId, images),
      onSuccess: invalidate,
    }),
    deleteImage: useMutation({
      meta: { successMessage: "Warehouse image removed" },
      mutationFn: (imageId: number) => warehouseService.deleteImage(imageId),
      onSuccess: invalidate,
    }),
    createZone: useMutation({
      meta: { successMessage: "Warehouse zone created" },
      mutationFn: ({
        warehouseId,
        payload,
      }: {
        warehouseId: number;
        payload: Record<string, unknown>;
      }) => warehouseService.createZone(warehouseId, payload),
      onSuccess: invalidate,
    }),
    createBin: useMutation({
      meta: { successMessage: "Storage bin created" },
      mutationFn: ({
        warehouseId,
        payload,
      }: {
        warehouseId: number;
        payload: Record<string, unknown>;
      }) => warehouseService.createBin(warehouseId, payload),
      onSuccess: invalidate,
    }),
    generateBins: useMutation({
      meta: { successMessage: "Storage bins generated" },
      mutationFn: ({
        warehouseId,
        payload,
      }: {
        warehouseId: number;
        payload: Parameters<typeof warehouseService.generateBins>[1];
      }) => warehouseService.generateBins(warehouseId, payload),
      onSuccess: invalidate,
    }),
    updateBin: useMutation({
      meta: { successMessage: "Storage bin updated" },
      mutationFn: ({
        binId,
        payload,
      }: {
        binId: number;
        payload: Record<string, unknown>;
      }) => warehouseService.updateBin(binId, payload),
      onSuccess: invalidate,
    }),
    createPallet: useMutation({
      meta: { successMessage: "Pallet created" },
      mutationFn: ({
        warehouseId,
        payload,
      }: {
        warehouseId: number;
        payload: Record<string, unknown>;
      }) => warehouseService.createPallet(warehouseId, payload),
      onSuccess: invalidate,
    }),
    movePallet: useMutation({
      meta: { successMessage: "Pallet moved" },
      mutationFn: ({
        palletId,
        toBinId,
      }: {
        palletId: number;
        toBinId: number;
      }) => warehouseService.movePallet(palletId, toBinId),
      onSuccess: invalidate,
    }),
  };
}

// --------------------------------------------------------------- inventory

export function useInventoryDashboard(filters?: {
  warehouseId?: number;
  from?: string;
  to?: string;
}) {
  return useQuery({
    queryKey: supplyChainKeys.inventoryDashboard(filters),
    queryFn: () => inventoryService.dashboard(filters),
    staleTime: LIVE_STALE_TIME,
  });
}

export function useStockPositions(filters?: {
  page?: number;
  limit?: number;
  warehouseId?: number;
  search?: string;
  itemType?: string;
  belowReorder?: boolean;
}) {
  const query = useQuery({
    queryKey: supplyChainKeys.stock(filters),
    queryFn: () => inventoryService.listStock(filters),
    staleTime: LIVE_STALE_TIME,
  });
  return {
    ...query,
    rows: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useProductStock(
  productId: number,
  filters?: { warehouseId?: number }
) {
  return useQuery({
    queryKey: supplyChainKeys.productStock(productId, filters),
    queryFn: () => inventoryService.productStock(productId, filters),
    enabled: !!productId,
    staleTime: LIVE_STALE_TIME,
  });
}

export function useStockMovements(
  filters?: Parameters<typeof inventoryService.listMovements>[0]
) {
  const query = useQuery({
    queryKey: supplyChainKeys.movements(filters),
    queryFn: () => inventoryService.listMovements(filters),
    staleTime: LIVE_STALE_TIME,
  });
  return {
    ...query,
    movements: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useStockLots(
  filters?: Parameters<typeof inventoryService.listLots>[0]
) {
  const query = useQuery({
    queryKey: supplyChainKeys.lots(filters),
    queryFn: () => inventoryService.listLots(filters),
    staleTime: LIVE_STALE_TIME,
  });
  return {
    ...query,
    lots: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useStockAlerts(
  filters?: Parameters<typeof inventoryService.listAlerts>[0]
) {
  const query = useQuery({
    queryKey: supplyChainKeys.alerts(filters),
    queryFn: () => inventoryService.listAlerts(filters),
    staleTime: LIVE_STALE_TIME,
  });
  return {
    ...query,
    alerts: query.data?.data ?? [],
    pagination: query.data?.pagination,
    summary: query.data?.summary ?? {},
  };
}

export function useReorderRules(filters?: {
  page?: number;
  limit?: number;
  warehouseId?: number;
  productId?: number;
}) {
  const query = useQuery({
    queryKey: supplyChainKeys.reorderRules(filters),
    queryFn: () => inventoryService.listReorderRules(filters),
    staleTime: LIVE_STALE_TIME,
  });
  return {
    ...query,
    rules: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useInventoryValuation(filters?: {
  warehouseId?: number;
  itemType?: string;
}) {
  return useQuery({
    queryKey: supplyChainKeys.valuation(filters),
    queryFn: () => inventoryService.valuation(filters),
    staleTime: LIVE_STALE_TIME,
  });
}

export function useUnitsOfMeasure() {
  return useQuery({
    queryKey: supplyChainKeys.units,
    queryFn: () => inventoryService.units(),
    staleTime: 60 * 60 * 1000,
  });
}

export function useStockCounts(filters?: {
  page?: number;
  limit?: number;
  warehouseId?: number;
  status?: string;
}) {
  const query = useQuery({
    queryKey: supplyChainKeys.counts(filters),
    queryFn: () => inventoryService.listCounts(filters),
    staleTime: LIVE_STALE_TIME,
  });
  return {
    ...query,
    counts: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useStockCount(id: number) {
  return useQuery({
    queryKey: supplyChainKeys.count(id),
    queryFn: () => inventoryService.getCount(id),
    enabled: !!id,
    staleTime: LIVE_STALE_TIME,
  });
}

/**
 * Anything that moves stock invalidates the whole inventory tree plus the
 * warehouse tree — a receipt changes on-hand, the ledger, alerts, valuation
 * and bin occupancy, and showing one of those stale is worse than a refetch.
 */
export function useInventoryMutations() {
  const queryClient = useQueryClient();
  const invalidateStock = () => {
    void queryClient.invalidateQueries({ queryKey: supplyChainKeys.inventory });
    void queryClient.invalidateQueries({
      queryKey: supplyChainKeys.warehouses,
    });
    void queryClient.invalidateQueries({ queryKey: supplyChainKeys.wms });
  };

  return {
    receive: useMutation({
      meta: { successMessage: "Stock receipt posted" },
      mutationFn: inventoryService.createReceipt,
      onSuccess: invalidateStock,
    }),
    adjust: useMutation({
      meta: { successMessage: "Stock adjustment posted" },
      mutationFn: inventoryService.createAdjustment,
      onSuccess: invalidateStock,
    }),
    transfer: useMutation({
      meta: { successMessage: "Stock transfer posted" },
      mutationFn: inventoryService.createTransfer,
      onSuccess: invalidateStock,
    }),
    evaluateAlerts: useMutation({
      meta: { successMessage: "Stock alerts refreshed" },
      mutationFn: (payload?: { warehouseId?: number; notify?: boolean }) =>
        inventoryService.evaluateAlerts(payload),
      onSuccess: invalidateStock,
    }),
    acknowledgeAlert: useMutation({
      meta: { successMessage: "Stock alert acknowledged" },
      mutationFn: ({ id, note }: { id: number; note?: string }) =>
        inventoryService.acknowledgeAlert(id, note),
      onSuccess: invalidateStock,
    }),
    resolveAlert: useMutation({
      meta: { successMessage: "Stock alert resolved" },
      mutationFn: ({ id, note }: { id: number; note?: string }) =>
        inventoryService.resolveAlert(id, note),
      onSuccess: invalidateStock,
    }),
    saveReorderRule: useMutation({
      meta: { successMessage: "Reorder policy saved" },
      mutationFn: inventoryService.saveReorderRule,
      onSuccess: invalidateStock,
    }),
    deleteReorderRule: useMutation({
      meta: { successMessage: "Reorder policy removed" },
      mutationFn: inventoryService.deleteReorderRule,
      onSuccess: invalidateStock,
    }),
    createCount: useMutation({
      meta: { successMessage: "Stock count created" },
      mutationFn: inventoryService.createCount,
      onSuccess: invalidateStock,
    }),
    recordCountLines: useMutation({
      meta: { successMessage: "Count quantities saved" },
      mutationFn: ({
        id,
        lines,
      }: {
        id: number;
        lines: Array<{
          lineId: number;
          countedQuantity: string;
          reasonCode?: string;
        }>;
      }) => inventoryService.recordCountLines(id, lines),
      onSuccess: invalidateStock,
    }),
    postCount: useMutation({
      meta: { successMessage: "Stock count posted" },
      mutationFn: ({ id, reasonCode }: { id: number; reasonCode?: string }) =>
        inventoryService.postCount(id, reasonCode),
      onSuccess: invalidateStock,
    }),
  };
}

// ---------------------------------------------------------------- material

export function useMaterials(
  filters?: Parameters<typeof materialService.list>[0]
) {
  const query = useQuery({
    queryKey: supplyChainKeys.materials(filters),
    queryFn: () => materialService.list(filters),
    staleTime: LIVE_STALE_TIME,
  });
  return {
    ...query,
    materials: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useMaterialShortages(filters?: { warehouseId?: number }) {
  return useQuery({
    queryKey: supplyChainKeys.materialShortages(filters),
    queryFn: () => materialService.shortages(filters),
    staleTime: LIVE_STALE_TIME,
  });
}

export function useConsumptionReport(
  filters?: Parameters<typeof materialService.consumption>[0]
) {
  return useQuery({
    queryKey: supplyChainKeys.consumption(filters),
    queryFn: () => materialService.consumption(filters),
    staleTime: MASTER_STALE_TIME,
  });
}

export function useMaterialRequisitions(
  filters?: Parameters<typeof materialService.listRequisitions>[0]
) {
  const query = useQuery({
    queryKey: supplyChainKeys.materialRequisitions(filters),
    queryFn: () => materialService.listRequisitions(filters),
    staleTime: LIVE_STALE_TIME,
  });
  return {
    ...query,
    requisitions: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useMaterialRequisition(id: number) {
  return useQuery({
    queryKey: supplyChainKeys.materialRequisition(id),
    queryFn: () => materialService.getRequisition(id),
    enabled: !!id,
    staleTime: LIVE_STALE_TIME,
  });
}

export function useMaterialMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ["supply-chain", "materials"],
    });
    void queryClient.invalidateQueries({ queryKey: supplyChainKeys.inventory });
  };

  return {
    checkAvailability: useMutation({
      meta: { successMessage: "Material availability checked" },
      mutationFn: materialService.availability,
    }),
    createRequisition: useMutation({
      meta: { successMessage: "Material requisition created" },
      mutationFn: materialService.createRequisition,
      onSuccess: invalidate,
    }),
    issueRequisition: useMutation({
      meta: { successMessage: "Materials issued" },
      mutationFn: ({
        id,
        payload,
      }: {
        id: number;
        payload?: Record<string, unknown>;
      }) => materialService.issueRequisition(id, payload),
      onSuccess: invalidate,
    }),
    cancelRequisition: useMutation({
      meta: { successMessage: "Material requisition cancelled" },
      mutationFn: materialService.cancelRequisition,
      onSuccess: invalidate,
    }),
  };
}

// --------------------------------------------------------------------- WMS

export function useWmsDashboard(filters?: { warehouseId?: number }) {
  return useQuery({
    queryKey: supplyChainKeys.wmsDashboard(filters),
    queryFn: () => wmsService.dashboard(filters),
    staleTime: LIVE_STALE_TIME,
  });
}

export function usePutawayTasks(
  filters?: Parameters<typeof wmsService.listPutawayTasks>[0]
) {
  const query = useQuery({
    queryKey: supplyChainKeys.putawayTasks(filters),
    queryFn: () => wmsService.listPutawayTasks(filters),
    staleTime: LIVE_STALE_TIME,
  });
  return {
    ...query,
    tasks: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function usePickLists(
  filters?: Parameters<typeof wmsService.listPickLists>[0]
) {
  const query = useQuery({
    queryKey: supplyChainKeys.pickLists(filters),
    queryFn: () => wmsService.listPickLists(filters),
    staleTime: LIVE_STALE_TIME,
  });
  return {
    ...query,
    pickLists: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function usePickList(id: number) {
  return useQuery({
    queryKey: supplyChainKeys.pickList(id),
    queryFn: () => wmsService.getPickList(id),
    enabled: !!id,
    staleTime: LIVE_STALE_TIME,
  });
}

export function usePackages(
  filters?: Parameters<typeof wmsService.listPackages>[0]
) {
  const query = useQuery({
    queryKey: supplyChainKeys.packages(filters),
    queryFn: () => wmsService.listPackages(filters),
    staleTime: LIVE_STALE_TIME,
  });
  return {
    ...query,
    packages: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useWmsMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: supplyChainKeys.wms });
    void queryClient.invalidateQueries({ queryKey: supplyChainKeys.inventory });
  };

  return {
    assignPutaway: useMutation({
      meta: { successMessage: "Putaway task assigned" },
      mutationFn: ({
        id,
        assignedToId,
      }: {
        id: number;
        assignedToId: number;
      }) => wmsService.assignPutawayTask(id, assignedToId),
      onSuccess: invalidate,
    }),
    completePutaway: useMutation({
      meta: { successMessage: "Putaway completed" },
      mutationFn: ({
        id,
        payload,
      }: {
        id: number;
        payload?: { toBinId?: number; quantity?: string };
      }) => wmsService.completePutaway(id, payload),
      onSuccess: invalidate,
    }),
    createPickList: useMutation({
      meta: { successMessage: "Pick list created" },
      mutationFn: wmsService.createPickList,
      onSuccess: invalidate,
    }),
    releasePickList: useMutation({
      meta: { successMessage: "Pick list released" },
      mutationFn: wmsService.releasePickList,
      onSuccess: invalidate,
    }),
    cancelPickList: useMutation({
      meta: { successMessage: "Pick list cancelled" },
      mutationFn: wmsService.cancelPickList,
      onSuccess: invalidate,
    }),
    confirmPick: useMutation({
      meta: { successMessage: "Pick confirmed" },
      mutationFn: ({
        pickTaskId,
        payload,
      }: {
        pickTaskId: number;
        payload?: { quantity?: string; notes?: string };
      }) => wmsService.confirmPick(pickTaskId, payload),
      onSuccess: invalidate,
    }),
    createPackage: useMutation({
      meta: { successMessage: "Package created" },
      mutationFn: ({
        pickListId,
        payload,
      }: {
        pickListId: number;
        payload: Record<string, unknown>;
      }) => wmsService.createPackage(pickListId, payload),
      onSuccess: invalidate,
    }),
    ship: useMutation({
      meta: { successMessage: "Shipment confirmed" },
      mutationFn: ({
        pickListId,
        packageIds,
      }: {
        pickListId: number;
        packageIds: number[];
      }) => wmsService.ship(pickListId, packageIds),
      onSuccess: invalidate,
    }),
  };
}

// --------------------------------------------------------------------- BOM

export function useBoms(filters?: Parameters<typeof bomService.list>[0]) {
  const query = useQuery({
    queryKey: supplyChainKeys.boms(filters),
    queryFn: () => bomService.list(filters),
    staleTime: MASTER_STALE_TIME,
  });
  return {
    ...query,
    boms: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useBom(id: number) {
  return useQuery({
    queryKey: supplyChainKeys.bom(id),
    queryFn: () => bomService.getById(id),
    enabled: !!id,
    staleTime: MASTER_STALE_TIME,
  });
}

export function useBomExplosion(
  id: number,
  quantity: string | number = 1,
  enabled = true
) {
  return useQuery({
    queryKey: supplyChainKeys.bomExplosion(id, quantity),
    queryFn: () => bomService.explode(id, { quantity }),
    enabled: !!id && enabled,
    staleTime: MASTER_STALE_TIME,
  });
}

export function useBomHistory(id: number) {
  const query = useQuery({
    queryKey: supplyChainKeys.bomHistory(id),
    queryFn: () => bomService.history(id, { limit: 100 }),
    enabled: !!id,
    staleTime: MASTER_STALE_TIME,
  });
  return { ...query, entries: query.data?.data ?? [] };
}

export function useWhereUsed(productId: number, enabled = true) {
  return useQuery({
    queryKey: supplyChainKeys.whereUsed(productId),
    queryFn: () => bomService.whereUsed(productId),
    enabled: !!productId && enabled,
    staleTime: MASTER_STALE_TIME,
  });
}

export function useBomMutations() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["supply-chain", "boms"] });

  return {
    create: useMutation({
      meta: { successMessage: "Bill of materials created" },
      mutationFn: bomService.create,
      onSuccess: invalidate,
    }),
    update: useMutation({
      meta: { successMessage: "Bill of materials updated" },
      mutationFn: ({
        id,
        payload,
      }: {
        id: number;
        payload: Record<string, unknown>;
      }) => bomService.update(id, payload),
      onSuccess: invalidate,
    }),
    changeStatus: useMutation({
      meta: { successMessage: "BOM status updated" },
      mutationFn: ({
        id,
        status,
        reason,
      }: {
        id: number;
        status: string;
        reason?: string;
      }) => bomService.changeStatus(id, status, reason),
      onSuccess: invalidate,
    }),
    addComponent: useMutation({
      meta: { successMessage: "BOM component added" },
      mutationFn: ({
        bomId,
        payload,
      }: {
        bomId: number;
        payload: Record<string, unknown>;
      }) => bomService.addComponent(bomId, payload),
      onSuccess: invalidate,
    }),
    replaceComponents: useMutation({
      meta: { successMessage: "BOM components replaced" },
      mutationFn: ({
        bomId,
        components,
        reason,
      }: {
        bomId: number;
        components: Array<Record<string, unknown>>;
        reason?: string;
      }) => bomService.replaceComponents(bomId, components, reason),
      onSuccess: invalidate,
    }),
    updateComponent: useMutation({
      meta: { successMessage: "BOM component updated" },
      mutationFn: ({
        componentId,
        payload,
      }: {
        componentId: number;
        payload: Record<string, unknown>;
      }) => bomService.updateComponent(componentId, payload),
      onSuccess: invalidate,
    }),
    removeComponent: useMutation({
      meta: { successMessage: "BOM component removed" },
      mutationFn: bomService.removeComponent,
      onSuccess: invalidate,
    }),
    addSubstitute: useMutation({
      meta: { successMessage: "Substitute added" },
      mutationFn: ({
        componentId,
        payload,
      }: {
        componentId: number;
        payload: Record<string, unknown>;
      }) => bomService.addSubstitute(componentId, payload),
      onSuccess: invalidate,
    }),
    removeSubstitute: useMutation({
      meta: { successMessage: "Substitute removed" },
      mutationFn: bomService.removeSubstitute,
      onSuccess: invalidate,
    }),
    costRollup: useMutation({
      meta: { successMessage: "BOM cost refreshed" },
      mutationFn: ({ id, persist }: { id: number; persist?: boolean }) =>
        bomService.costRollup(id, persist ?? true),
      onSuccess: invalidate,
    }),
    revise: useMutation({
      meta: { successMessage: "BOM revision created" },
      mutationFn: ({
        id,
        payload,
      }: {
        id: number;
        payload?: { reason?: string; revision?: string };
      }) => bomService.revise(id, payload),
      onSuccess: invalidate,
    }),
  };
}

// --------------------------------------------------------------- suppliers

export function useSuppliers(
  filters?: Parameters<typeof supplierService.list>[0]
) {
  const query = useQuery({
    queryKey: supplyChainKeys.suppliers(filters),
    queryFn: () => supplierService.list(filters),
    staleTime: MASTER_STALE_TIME,
  });
  return {
    ...query,
    suppliers: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useSupplier(id: number) {
  return useQuery({
    queryKey: supplyChainKeys.supplier(id),
    queryFn: () => supplierService.getById(id),
    enabled: !!id,
    staleTime: MASTER_STALE_TIME,
  });
}

export function useSupplierCatalogue(
  supplierId: number,
  filters?: { page?: number; limit?: number; activeOnly?: boolean }
) {
  const query = useQuery({
    queryKey: supplyChainKeys.supplierCatalogue(supplierId, filters),
    queryFn: () => supplierService.listCatalogue(supplierId, filters),
    enabled: !!supplierId,
    staleTime: MASTER_STALE_TIME,
  });
  return {
    ...query,
    entries: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useSupplierPerformance(
  id: number,
  filters?: { from?: string; to?: string }
) {
  return useQuery({
    queryKey: supplyChainKeys.supplierPerformance(id, filters),
    queryFn: () => supplierService.performance(id, filters),
    enabled: !!id,
    staleTime: MASTER_STALE_TIME,
  });
}

export function useSupplierScorecards(filters?: {
  from?: string;
  to?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: supplyChainKeys.scorecards(filters),
    queryFn: () => supplierService.scorecards(filters),
    staleTime: MASTER_STALE_TIME,
  });
}

export function useDeliveryWatchlist(filters?: {
  warehouseId?: number;
  daysAhead?: number;
}) {
  return useQuery({
    queryKey: supplyChainKeys.deliveryWatchlist(filters),
    queryFn: () => supplierService.deliveryWatchlist(filters),
    staleTime: LIVE_STALE_TIME,
  });
}

export function usePriceComparison(
  productId: number,
  quantity: string | number = 1,
  enabled = true
) {
  return useQuery({
    queryKey: supplyChainKeys.priceComparison(productId, quantity),
    queryFn: () => supplierService.priceComparison(productId, quantity),
    enabled: !!productId && enabled,
    staleTime: MASTER_STALE_TIME,
  });
}

export function useSupplierMutations() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["supply-chain", "suppliers"] });

  return {
    create: useMutation({
      meta: { successMessage: "Supplier created" },
      mutationFn: supplierService.create,
      onSuccess: invalidate,
    }),
    update: useMutation({
      meta: { successMessage: "Supplier updated" },
      mutationFn: ({
        id,
        payload,
      }: {
        id: number;
        payload: Record<string, unknown>;
      }) => supplierService.update(id, payload),
      onSuccess: invalidate,
    }),
    addContact: useMutation({
      meta: { successMessage: "Supplier contact added" },
      mutationFn: ({
        supplierId,
        payload,
      }: {
        supplierId: number;
        payload: Record<string, unknown>;
      }) => supplierService.addContact(supplierId, payload),
      onSuccess: invalidate,
    }),
    removeContact: useMutation({
      meta: { successMessage: "Supplier contact removed" },
      mutationFn: supplierService.removeContact,
      onSuccess: invalidate,
    }),
    savePrice: useMutation({
      meta: { successMessage: "Catalogue price saved" },
      mutationFn: ({
        supplierId,
        payload,
      }: {
        supplierId: number;
        payload: Record<string, unknown>;
      }) => supplierService.saveCataloguePrice(supplierId, payload),
      onSuccess: invalidate,
    }),
    removePrice: useMutation({
      meta: { successMessage: "Catalogue price removed" },
      mutationFn: supplierService.removeCatalogueEntry,
      onSuccess: invalidate,
    }),
    snapshotPerformance: useMutation({
      meta: { successMessage: "Supplier performance refreshed" },
      mutationFn: ({
        id,
        params,
      }: {
        id: number;
        params?: { from?: string; to?: string };
      }) => supplierService.snapshotPerformance(id, params),
      onSuccess: invalidate,
    }),
  };
}

// -------------------------------------------------------------- purchasing

export function usePurchasingDashboard(filters?: { warehouseId?: number }) {
  return useQuery({
    queryKey: supplyChainKeys.purchasingDashboard(filters),
    queryFn: () => purchaseOrderService.dashboard(filters),
    staleTime: LIVE_STALE_TIME,
  });
}

export function usePurchaseRequisitions(
  filters?: Parameters<typeof purchaseRequisitionService.list>[0]
) {
  const query = useQuery({
    queryKey: supplyChainKeys.requisitions(filters),
    queryFn: () => purchaseRequisitionService.list(filters),
    staleTime: LIVE_STALE_TIME,
  });
  return {
    ...query,
    requisitions: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function usePurchaseRequisition(id: number) {
  return useQuery({
    queryKey: supplyChainKeys.requisition(id),
    queryFn: () => purchaseRequisitionService.getById(id),
    enabled: !!id,
    staleTime: LIVE_STALE_TIME,
  });
}

export function usePurchaseOrders(
  filters?: Parameters<typeof purchaseOrderService.list>[0]
) {
  const query = useQuery({
    queryKey: supplyChainKeys.purchaseOrders(filters),
    queryFn: () => purchaseOrderService.list(filters),
    staleTime: LIVE_STALE_TIME,
  });
  return {
    ...query,
    orders: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function usePurchaseOrder(id: number) {
  return useQuery({
    queryKey: supplyChainKeys.purchaseOrder(id),
    queryFn: () => purchaseOrderService.getById(id),
    enabled: !!id,
    staleTime: LIVE_STALE_TIME,
  });
}

export function usePurchasingMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ["supply-chain", "purchase-orders"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["supply-chain", "purchase-requisitions"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["supply-chain", "suppliers"],
    });
  };

  return {
    createRequisition: useMutation({
      meta: { successMessage: "Purchase requisition created" },
      mutationFn: purchaseRequisitionService.create,
      onSuccess: invalidate,
    }),
    setRequisitionStatus: useMutation({
      meta: { successMessage: "Requisition status updated" },
      mutationFn: ({
        id,
        status,
        reason,
      }: {
        id: number;
        status: string;
        reason?: string;
      }) => purchaseRequisitionService.setStatus(id, status, reason),
      onSuccess: invalidate,
    }),
    convertRequisition: useMutation({
      meta: { successMessage: "Requisition converted to an order" },
      mutationFn: ({
        id,
        payload,
      }: {
        id: number;
        payload: Record<string, unknown>;
      }) => purchaseRequisitionService.convert(id, payload),
      onSuccess: invalidate,
    }),
    createOrder: useMutation({
      meta: { successMessage: "Purchase order created" },
      mutationFn: purchaseOrderService.create,
      onSuccess: invalidate,
    }),
    updateOrder: useMutation({
      meta: { successMessage: "Purchase order updated" },
      mutationFn: ({
        id,
        payload,
      }: {
        id: number;
        payload: Record<string, unknown>;
      }) => purchaseOrderService.update(id, payload),
      onSuccess: invalidate,
    }),
    submitForApproval: useMutation({
      meta: { successMessage: "Purchase order submitted for approval" },
      mutationFn: ({
        id,
        payload,
      }: {
        id: number;
        payload: { requestedToId: number; comment?: string };
      }) => purchaseOrderService.submitForApproval(id, payload),
      onSuccess: invalidate,
    }),
    setOrderStatus: useMutation({
      meta: { successMessage: "Purchase order status updated" },
      mutationFn: ({
        id,
        status,
        reason,
      }: {
        id: number;
        status: string;
        reason?: string;
      }) => purchaseOrderService.setStatus(id, status, reason),
      onSuccess: invalidate,
    }),
  };
}

// ---------------------------------------------------------------- receipts

export function useGoodsReceipts(
  filters?: Parameters<typeof goodsReceiptService.list>[0]
) {
  const query = useQuery({
    queryKey: supplyChainKeys.goodsReceipts(filters),
    queryFn: () => goodsReceiptService.list(filters),
    staleTime: LIVE_STALE_TIME,
  });
  return {
    ...query,
    receipts: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useGoodsReceipt(id: number) {
  return useQuery({
    queryKey: supplyChainKeys.goodsReceipt(id),
    queryFn: () => goodsReceiptService.getById(id),
    enabled: !!id,
    staleTime: LIVE_STALE_TIME,
  });
}

export function useQualityChecks(
  filters?: Parameters<typeof goodsReceiptService.listQualityChecks>[0]
) {
  const query = useQuery({
    queryKey: supplyChainKeys.qualityChecks(filters),
    queryFn: () => goodsReceiptService.listQualityChecks(filters),
    staleTime: LIVE_STALE_TIME,
  });
  return {
    ...query,
    checks: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useGoodsReceiptMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ["supply-chain", "goods-receipts"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["supply-chain", "purchase-orders"],
    });
    void queryClient.invalidateQueries({ queryKey: supplyChainKeys.inventory });
    void queryClient.invalidateQueries({ queryKey: supplyChainKeys.wms });
  };

  return {
    create: useMutation({
      meta: { successMessage: "Goods receipt created" },
      mutationFn: goodsReceiptService.create,
      onSuccess: invalidate,
    }),
    post: useMutation({
      meta: { successMessage: "Goods receipt posted" },
      mutationFn: ({
        id,
        createPutawayTasks,
      }: {
        id: number;
        createPutawayTasks?: boolean;
      }) => goodsReceiptService.post(id, createPutawayTasks ?? true),
      onSuccess: invalidate,
    }),
    cancel: useMutation({
      meta: { successMessage: "Goods receipt cancelled" },
      mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
        goodsReceiptService.cancel(id, reason),
      onSuccess: invalidate,
    }),
    recordQualityCheck: useMutation({
      meta: { successMessage: "Quality check saved" },
      mutationFn: ({
        grnLineId,
        payload,
      }: {
        grnLineId: number;
        payload: Record<string, unknown>;
      }) => goodsReceiptService.recordQualityCheck(grnLineId, payload),
      onSuccess: invalidate,
    }),
  };
}

// -------------------------------------------------------------- production

export function useProductionOrders(
  filters?: Parameters<typeof productionOrderService.list>[0]
) {
  const query = useQuery({
    queryKey: supplyChainKeys.productionOrders(filters),
    queryFn: () => productionOrderService.list(filters),
    staleTime: LIVE_STALE_TIME,
  });
  return {
    ...query,
    orders: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useProductionOrder(id: number) {
  return useQuery({
    queryKey: supplyChainKeys.productionOrder(id),
    queryFn: () => productionOrderService.getById(id),
    enabled: !!id,
    staleTime: LIVE_STALE_TIME,
  });
}

export function useProductionVariance(id: number, enabled = true) {
  return useQuery({
    queryKey: supplyChainKeys.productionVariance(id),
    queryFn: () => productionOrderService.variance(id),
    enabled: !!id && enabled,
    staleTime: LIVE_STALE_TIME,
  });
}

export function useProductionMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ["supply-chain", "production-orders"],
    });
    void queryClient.invalidateQueries({ queryKey: supplyChainKeys.inventory });
    void queryClient.invalidateQueries({
      queryKey: ["supply-chain", "materials"],
    });
  };

  return {
    create: useMutation({
      meta: { successMessage: "Production order created" },
      mutationFn: productionOrderService.create,
      onSuccess: invalidate,
    }),
    release: useMutation({
      meta: { successMessage: "Production order released" },
      mutationFn: ({
        id,
        reserveMaterials,
      }: {
        id: number;
        reserveMaterials?: boolean;
      }) => productionOrderService.release(id, reserveMaterials ?? true),
      onSuccess: invalidate,
    }),
    complete: useMutation({
      meta: { successMessage: "Production order completed" },
      mutationFn: ({
        id,
        payload,
      }: {
        id: number;
        payload: Record<string, unknown>;
      }) => productionOrderService.complete(id, payload),
      onSuccess: invalidate,
    }),
    cancel: useMutation({
      meta: { successMessage: "Production order cancelled" },
      mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
        productionOrderService.cancel(id, reason),
      onSuccess: invalidate,
    }),
  };
}
