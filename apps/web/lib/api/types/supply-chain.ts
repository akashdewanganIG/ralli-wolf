export type DecimalString = string;

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Paginated<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface Wrapped<T> {
  data: T;
}

export type ItemType =
  | "FINISHED_GOOD"
  | "ACCESSORY"
  | "SPARE_PART"
  | "RAW_MATERIAL"
  | "COMPONENT"
  | "CONSUMABLE"
  | "PACKAGING"
  | "SERVICE";

export type TrackingType = "NONE" | "BATCH" | "SERIAL";
export type PickingStrategy = "FIFO" | "LIFO" | "FEFO";
export type ValuationMethod = "FIFO" | "LIFO" | "WEIGHTED_AVERAGE" | "STANDARD";
export type WarehouseType =
  | "WAREHOUSE"
  | "PLANT"
  | "STORE"
  | "TRANSIT"
  | "VIRTUAL";
export type ZoneType =
  | "RECEIVING"
  | "STORAGE"
  | "PICKING"
  | "PACKING"
  | "SHIPPING"
  | "QUARANTINE"
  | "RETURNS"
  | "PRODUCTION"
  | "STAGING";
export type BinType =
  | "PALLET_RACK"
  | "SHELF"
  | "BULK_FLOOR"
  | "BIN_BOX"
  | "CAROUSEL"
  | "HAZMAT"
  | "COLD_STORAGE";
export type StockStatus =
  | "AVAILABLE"
  | "QUARANTINE"
  | "BLOCKED"
  | "DAMAGED"
  | "EXPIRED"
  | "IN_TRANSIT";
export type MovementDirection = "IN" | "OUT" | "INTERNAL";
export type StockMovementType =
  | "OPENING_BALANCE"
  | "PURCHASE_RECEIPT"
  | "PURCHASE_RETURN"
  | "SALES_ISSUE"
  | "SALES_RETURN"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "INTERNAL_MOVE"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "PRODUCTION_CONSUMPTION"
  | "PRODUCTION_RECEIPT"
  | "SCRAP"
  | "CYCLE_COUNT_GAIN"
  | "CYCLE_COUNT_LOSS"
  | "EXPIRY_WRITE_OFF";
export type StockAlertType =
  | "REORDER_POINT"
  | "BELOW_SAFETY_STOCK"
  | "STOCKOUT"
  | "OVERSTOCK"
  | "EXPIRY_WARNING"
  | "EXPIRED"
  | "NEGATIVE_STOCK";
export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
export type TaskStatus =
  | "PENDING"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";
export type PickListStatus =
  | "DRAFT"
  | "RELEASED"
  | "IN_PROGRESS"
  | "PICKED"
  | "PACKED"
  | "SHIPPED"
  | "CANCELLED";
export type PackageStatus = "OPEN" | "PACKED" | "SHIPPED" | "CANCELLED";
export type BomStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "OBSOLETE";
export type SupplierStatus =
  | "DRAFT"
  | "ACTIVE"
  | "ON_HOLD"
  | "BLACKLISTED"
  | "INACTIVE";
export type PurchaseRequisitionStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "PARTIALLY_CONVERTED"
  | "CONVERTED"
  | "CANCELLED";
export type PurchaseOrderStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "SENDING"
  | "SENT"
  | "ACKNOWLEDGED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CLOSED"
  | "CANCELLED";
export type PurchaseOrderLineStatus =
  | "OPEN"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";
export type GrnStatus =
  | "DRAFT"
  | "PENDING_QC"
  | "QC_IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";
export type QcResult = "PENDING" | "PASS" | "FAIL" | "CONDITIONAL_PASS";
export type MaterialRequisitionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PARTIALLY_ISSUED"
  | "ISSUED"
  | "CANCELLED";
export type ProductionOrderStatus =
  | "DRAFT"
  | "PLANNED"
  | "RELEASED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CLOSED"
  | "CANCELLED";
export type StockCountStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "PENDING_APPROVAL"
  | "COMPLETED"
  | "CANCELLED";

export interface ProductRef {
  id: number;
  code: string;
  name: string;
  imageUrl?: string | null;
  itemType?: ItemType;
  trackingType?: TrackingType;
  uom?: { code: string } | null;
}

export interface UserRef {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email?: string;
}

export interface WarehouseRef {
  id: number;
  code: string;
  name: string;
}

export interface BinRef {
  id: number;
  code: string;
  aisle?: string | null;
  rack?: string | null;
  level?: string | null;
  zone?: { id: number; code: string; name: string };
}

export interface SupplierRef {
  id: number;
  code: string;
  name: string;
}

export interface UnitOfMeasure {
  id: number;
  code: string;
  name: string;
  category: "COUNT" | "WEIGHT" | "LENGTH" | "VOLUME" | "AREA" | "TIME";
  baseFactor: DecimalString;
  isBaseUnit: boolean;
  decimals: number;
  isActive: boolean;
}

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  type: WarehouseType;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  gstNumber: string | null;
  isActive: boolean;
  isDefault: boolean;
  allowNegativeStock: boolean;
  createdAt: string;
  images?: WarehouseImage[];
  _count?: { zones: number; bins: number; stockBalances: number };
  zones?: WarehouseZone[];
}

export interface WarehouseImage {
  id: number;
  warehouseId: number;
  url: string;
  sortOrder: number;
  createdAt: string;
}

export interface EntityImage {
  id: number;
  url: string;
  sortOrder: number;
  caption?: string | null;
  createdAt: string;
}

export interface ProductImage extends EntityImage {
  productId: number;
}

export interface GoodsReceiptImage extends EntityImage {
  grnId: number;
  grnLineId?: number | null;
}

export interface QualityCheckImage extends EntityImage {
  qualityCheckId: number;
}

export interface WarehouseZone {
  id: number;
  warehouseId: number;
  code: string;
  name: string;
  zoneType: ZoneType;
  temperatureControlled: boolean;
  isActive: boolean;
  _count?: { bins: number };
}

export interface StorageBin {
  id: number;
  warehouseId: number;
  zoneId: number;
  code: string;
  aisle: string | null;
  rack: string | null;
  level: string | null;
  position: string | null;
  binType: BinType;
  pickSequence: number;
  maxWeightKg: DecimalString | null;
  maxVolumeM3: DecimalString | null;
  isPickFace: boolean;
  isReceiving: boolean;
  isShipping: boolean;
  isQuarantine: boolean;
  isBlocked: boolean;
  isActive: boolean;
  zone?: { id: number; code: string; name: string; zoneType?: ZoneType };
  _count?: { stockBalances: number };
}

export interface BinUtilisationRow {
  binId: number;
  binCode: string;
  zone: { id: number; code: string; name: string; zoneType: ZoneType };
  aisle: string | null;
  rack: string | null;
  level: string | null;
  binType: BinType;
  isPickFace: boolean;
  isBlocked: boolean;
  distinctItems: number;
  totalQuantity: DecimalString;
  usedWeightKg: DecimalString;
  maxWeightKg: DecimalString | null;
  weightUtilisationPercent: DecimalString | null;
  usedVolumeM3: DecimalString;
  maxVolumeM3: DecimalString | null;
  volumeUtilisationPercent: DecimalString | null;
  isEmpty: boolean;
}

export interface StorageUtilisation {
  warehouseId: number;
  totalBins: number;
  emptyBins: number;
  blockedBins: number;
  binsOverCapacity: number;
  rows: BinUtilisationRow[];
}

export interface Pallet {
  id: number;
  code: string;
  warehouseId: number;
  binId: number | null;
  status: "EMPTY" | "IN_USE" | "STAGED" | "SHIPPED" | "DAMAGED";
  grossWeightKg: DecimalString | null;
  notes: string | null;
  bin?: { id: number; code: string } | null;
  stockBalances?: Array<{
    quantity: DecimalString;
    product: ProductRef;
    lot: { lotNumber: string };
  }>;
}

export interface StockPositionRow {
  product: ProductRef & {
    pickingStrategy?: PickingStrategy;
    standardCost: DecimalString | null;
    category?: { id: number; name: string };
  };
  warehouseId: number | null;
  onHandQuantity: DecimalString;
  reservedQuantity: DecimalString;
  availableQuantity: DecimalString;
  incomingQuantity: DecimalString;
  stockValue: DecimalString;
  averageUnitCost: DecimalString;
  safetyStock: DecimalString | null;
  reorderPoint: DecimalString | null;
  reorderQuantity: DecimalString | null;
  maximumStock: DecimalString | null;
  isBelowReorderPoint: boolean;
  isBelowSafetyStock: boolean;
  isStockedOut: boolean;
}

export interface StockLotRef {
  id: number;
  lotNumber: string;
  batchNumber: string | null;
  serialNumber: string | null;
  expiryDate: string | null;
  manufacturedDate?: string | null;
  receivedAt?: string;
  unitCost?: DecimalString;
  status?: string;
  supplier?: SupplierRef | null;
}

export interface StockLocationRow {
  id: number;
  quantity: DecimalString;
  reservedQuantity: DecimalString;
  status: StockStatus;
  lastMovementAt: string | null;
  warehouse: WarehouseRef;
  bin: BinRef;
  lot: StockLotRef;
  pallet: { id: number; code: string } | null;
}

export interface ProductStockDetail {
  product: ProductRef & {
    pickingStrategy: PickingStrategy;
    valuationMethod: ValuationMethod;
    shelfLifeDays: number | null;
    standardCost: DecimalString | null;
  };
  totals: Array<{
    warehouse: WarehouseRef;
    onHandQuantity: DecimalString;
    reservedQuantity: DecimalString;
    availableQuantity: DecimalString;
    stockValue: DecimalString;
  }>;
  locations: StockLocationRow[];
  reservations: Array<{
    id: number;
    quantity: DecimalString;
    releasedQuantity: DecimalString;
    referenceType: string;
    referenceId: number;
    referenceNumber: string | null;
    createdAt: string;
    warehouse: { id: number; code: string };
  }>;
}

export interface StockMovement {
  id: number;
  movementNumber: string;
  movementType: StockMovementType;
  direction: MovementDirection;
  quantity: DecimalString;
  unitCost: DecimalString;
  totalCost: DecimalString;
  referenceType: string | null;
  referenceId: number | null;
  referenceNumber: string | null;
  reasonCode: string | null;
  notes: string | null;
  occurredAt: string;
  product: ProductRef;
  lot: StockLotRef | null;
  uom: { code: string } | null;
  fromWarehouse: { id: number; code: string } | null;
  toWarehouse: { id: number; code: string } | null;
  fromBin: { id: number; code: string } | null;
  toBin: { id: number; code: string } | null;
  performedBy: UserRef | null;
}

export interface StockLot extends StockLotRef {
  productId: number;
  originalQuantity: DecimalString;
  remainingQuantity: DecimalString;
  unitCost: DecimalString;
  sourceType: string;
  sourceReference: string | null;
  product: ProductRef;
  originWarehouse: { id: number; code: string };
  balances: Array<{
    quantity: DecimalString;
    warehouse: { id: number; code: string };
    bin: { id: number; code: string };
  }>;
}

export interface StockAlert {
  id: number;
  alertType: StockAlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  currentQuantity: DecimalString;
  thresholdQuantity: DecimalString;
  shortfallQuantity: DecimalString;
  message: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  product: ProductRef;
  warehouse: WarehouseRef;
  acknowledgedBy: UserRef | null;
}

export interface ReorderRule {
  id: number;
  productId: number;
  warehouseId: number;
  safetyStock: DecimalString;
  reorderPoint: DecimalString;
  reorderQuantity: DecimalString;
  maximumStock: DecimalString | null;
  leadTimeDays: number;
  autoRequisition: boolean;
  preferredSupplierId: number | null;
  isActive: boolean;
  lastEvaluatedAt: string | null;
  product: ProductRef;
  warehouse: WarehouseRef;
  preferredSupplier: SupplierRef | null;
  currentAvailable?: DecimalString;
  currentOnHand?: DecimalString;
}

export interface InventoryDashboard {
  period: { from: string; to: string };
  totalStockValue: DecimalString;
  totalQuantity: DecimalString;
  reservedQuantity: DecimalString;
  availableQuantity: DecimalString;
  distinctItems: number;
  activeWarehouses: number;
  openAlerts: number;
  alertsBySeverity: Partial<Record<AlertSeverity, number>>;
  lotsExpiringSoon: number;
  inboundValue: DecimalString;
  outboundValue: DecimalString;
  movementCount: number;
  movementsByType: Array<{
    movementType: StockMovementType;
    count: number;
    quantity: DecimalString;
  }>;
}

export interface InventoryValuation {
  totalValue: DecimalString;
  distinctItems: number;
  byWarehouse: Array<{
    warehouse: WarehouseRef;
    quantity: DecimalString;
    value: DecimalString;
  }>;
  byItemType: Array<{
    itemType: ItemType;
    quantity: DecimalString;
    value: DecimalString;
  }>;
  products: Array<{
    product: ProductRef;
    quantity: DecimalString;
    value: DecimalString;
    averageUnitCost: DecimalString;
  }>;
}

export interface AlertEvaluationSummary {
  evaluatedRules: number;
  raised: number;
  resolved: number;
  requisitionsCreated: number;
  alerts: Array<{
    productCode: string;
    warehouseCode: string;
    alertType: StockAlertType;
    severity: AlertSeverity;
    message: string;
  }>;
}

export interface StockCount {
  id: number;
  countNumber: string;
  warehouseId: number;
  countType: "CYCLE" | "FULL" | "SPOT";
  status: StockCountStatus;
  scheduledDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  warehouse?: WarehouseRef;
  countedBy?: UserRef | null;
  approvedBy?: UserRef | null;
  _count?: { lines: number };
  lines?: StockCountLine[];
}

export interface StockCountLine {
  id: number;
  productId: number;
  binId: number;
  lotId: number | null;
  systemQuantity: DecimalString;
  countedQuantity: DecimalString | null;
  varianceQuantity: DecimalString;
  varianceValue: DecimalString;
  reasonCode: string | null;
  isPosted: boolean;
  notes: string | null;
  product: ProductRef;
  bin: { id: number; code: string };
  lot: {
    id: number;
    lotNumber: string;
    batchNumber: string | null;
    unitCost: DecimalString;
  } | null;
}

export interface MaterialRow extends ProductRef {
  standardCost: DecimalString | null;
  shelfLifeDays: number | null;
  isPurchasable: boolean;
  category: { id: number; name: string } | null;
  onHandQuantity: DecimalString;
  reservedQuantity: DecimalString;
  availableQuantity: DecimalString;
  incomingQuantity: DecimalString;
  stockValue: DecimalString;
  safetyStock: DecimalString | null;
  reorderPoint: DecimalString | null;
  isBelowSafetyStock: boolean;
}

export interface AvailabilityLine {
  productId: number;
  productCode: string;
  productName: string;
  itemType: ItemType;
  uomCode: string | null;
  requiredQuantity: DecimalString;
  onHandQuantity: DecimalString;
  reservedQuantity: DecimalString;
  availableQuantity: DecimalString;
  incomingQuantity: DecimalString;
  safetyStock: DecimalString;
  shortfallQuantity: DecimalString;
  netShortfallQuantity: DecimalString;
  coveragePercent: DecimalString;
  isShort: boolean;
  substitutes: Array<{
    productId: number;
    productCode: string;
    productName: string;
    priority: number;
    conversionFactor: DecimalString;
    availableQuantity: DecimalString;
    coverableQuantity: DecimalString;
  }>;
}

export interface AvailabilityResult {
  productId: number;
  bomId: number;
  bomNumber: string;
  requestedQuantity: DecimalString;
  buildableQuantity: DecimalString;
  canBuild: boolean;
  totalMaterialCost: DecimalString;
  lines: AvailabilityLine[];
}

export interface ConsumptionRow {
  productId: number;
  productCode: string;
  productName: string;
  itemType: ItemType;
  uomCode: string | null;
  consumedQuantity: DecimalString;
  consumedValue: DecimalString;
  wastedQuantity: DecimalString;
  wastedValue: DecimalString;
  expiredQuantity: DecimalString;
  expiredValue: DecimalString;
  totalIssuedQuantity: DecimalString;
  totalValue: DecimalString;
  wastagePercent: DecimalString;
  wastageValue: DecimalString;
}

export interface ConsumptionReport {
  from: string;
  to: string;
  rows: ConsumptionRow[];
  totals: {
    consumedValue: DecimalString;
    wastedValue: DecimalString;
    expiredValue: DecimalString;
    totalValue: DecimalString;
    wastagePercent: DecimalString;
  };
}

export interface ShortageRow {
  product: ProductRef & { standardCost: DecimalString | null };
  warehouse: WarehouseRef;
  preferredSupplier: (SupplierRef & { leadTimeDays: number }) | null;
  onHandQuantity: DecimalString;
  availableQuantity: DecimalString;
  incomingQuantity: DecimalString;
  projectedQuantity: DecimalString;
  safetyStock: DecimalString;
  reorderPoint: DecimalString;
  reorderQuantity: DecimalString;
  shortfallQuantity: DecimalString;
  leadTimeDays: number;
  estimatedValue: DecimalString;
  autoRequisition: boolean;
}

export interface MaterialRequisition {
  id: number;
  requisitionNumber: string;
  warehouseId: number;
  status: MaterialRequisitionStatus;
  requiredByDate: string | null;
  purpose: string | null;
  notes: string | null;
  issuedAt: string | null;
  createdAt: string;
  warehouse: WarehouseRef;
  requestedBy: UserRef;
  issuedBy: UserRef | null;
  productionOrder: {
    id: number;
    orderNumber: string;
    status?: ProductionOrderStatus;
  } | null;
  _count?: { lines: number };
  lines?: MaterialRequisitionLine[];
}

export interface MaterialRequisitionLine {
  id: number;
  productId: number;
  requestedQuantity: DecimalString;
  issuedQuantity: DecimalString;
  notes: string | null;
  product: ProductRef;
  uom: { id: number; code: string } | null;
  availableQuantity?: DecimalString;
}

export interface PutawayTask {
  id: number;
  taskNumber: string;
  quantity: DecimalString;
  movedQuantity: DecimalString;
  status: TaskStatus;
  priority: number;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  product: ProductRef;
  lot: StockLotRef;
  fromBin: { id: number; code: string };
  toBin: BinRef | null;
  warehouse: { id: number; code: string };
  assignedTo: UserRef | null;
}

export interface PutawaySuggestion {
  binId: number;
  binCode: string;
  zoneName: string;
  reason: string;
  score: number;
  currentQuantity: DecimalString;
  remainingWeightKg: DecimalString | null;
}

export interface PickTask {
  id: number;
  sequence: number;
  requestedQuantity: DecimalString;
  pickedQuantity: DecimalString;
  shortQuantity: DecimalString;
  status: TaskStatus;
  pickedAt: string | null;
  notes: string | null;
  product: ProductRef;
  lot: StockLotRef;
  bin: BinRef;
  pickedBy: UserRef | null;
}

export interface PickList {
  id: number;
  pickListNumber: string;
  warehouseId: number;
  status: PickListStatus;
  strategy: PickingStrategy;
  referenceType: string;
  referenceId: number;
  referenceNumber: string | null;
  releasedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  warehouse: WarehouseRef;
  assignedTo: UserRef | null;
  releasedBy?: UserRef | null;
  _count?: { tasks: number; packages: number };
  tasks?: PickTask[];
  packages?: PackageRecord[];
}

export interface PackageRecord {
  id: number;
  packageNumber: string;
  status: PackageStatus;
  grossWeightKg: DecimalString | null;
  lengthCm: DecimalString | null;
  widthCm: DecimalString | null;
  heightCm: DecimalString | null;
  trackingNumber: string | null;
  carrier: string | null;
  packedAt: string | null;
  shippedAt: string | null;
  createdAt: string;
  pallet: { id: number; code: string } | null;
  packedBy?: UserRef | null;
  pickList?: {
    id: number;
    pickListNumber: string;
    referenceNumber: string | null;
    referenceType: string;
  };
  lines?: Array<{
    id: number;
    quantity: DecimalString;
    product: ProductRef;
    lot: { id: number; lotNumber: string };
  }>;
  _count?: { lines: number };
}

export interface WmsDashboard {
  openPutawayTasks: number;
  openPickLists: number;
  pendingPickTasks: number;
  packagesAwaitingDispatch: number;
  totalBins: number;
  occupiedBins: number;
  emptyBins: number;
  binOccupancyPercent: number;
  palletsInUse: number;
}

export interface BomSummary {
  id: number;
  bomNumber: string;
  productId: number;
  name: string;
  version: number;
  revision: string;
  status: BomStatus;
  isDefault: boolean;
  outputQuantity: DecimalString;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  rolledUpCost: DecimalString | null;
  costedAt: string | null;
  laborCost: DecimalString;
  overheadCost: DecimalString;
  notes: string | null;
  approvedAt: string | null;
  createdAt: string;
  product: ProductRef;
  uom: { id: number; code: string } | null;
  createdBy: UserRef;
  approvedBy: UserRef | null;
  _count?: { components: number };
}

export interface BomComponent {
  id: number;
  bomId: number;
  componentProductId: number;
  lineNumber: number;
  quantity: DecimalString;
  scrapPercent: DecimalString;
  isOptional: boolean;
  isPhantom: boolean;
  operationSequence: number | null;
  referenceDesignator: string | null;
  notes: string | null;
  componentProduct: ProductRef & {
    isManufactured: boolean;
    standardCost: DecimalString | null;
  };
  uom: { id: number; code: string } | null;
  substitutes: BomSubstitute[];
}

export interface BomSubstitute {
  id: number;
  bomComponentId: number;
  substituteProductId: number;
  priority: number;
  conversionFactor: DecimalString;
  isActive: boolean;
  notes: string | null;
  substituteProduct: ProductRef & { standardCost: DecimalString | null };
}

export interface BomDetail extends BomSummary {
  components: BomComponent[];
  previousVersion: {
    id: number;
    bomNumber: string;
    version: number;
    revision: string;
  } | null;
  nextVersion: {
    id: number;
    bomNumber: string;
    version: number;
    revision: string;
  } | null;
}

export interface ExplodedComponent {
  level: number;
  path: string;
  bomId: number;
  bomComponentId: number;
  productId: number;
  productCode: string;
  productName: string;
  itemType: ItemType;
  uomCode: string | null;
  quantityPerParent: DecimalString;
  requiredQuantity: DecimalString;
  scrapPercent: DecimalString;
  isPhantom: boolean;
  isOptional: boolean;
  hasChildBom: boolean;
  childBomId: number | null;
  unitCost: DecimalString;
  extendedCost: DecimalString;
  substitutes: Array<{
    productId: number;
    productCode: string;
    productName: string;
    priority: number;
    conversionFactor: DecimalString;
  }>;
}

export interface BomExplosion {
  bom: {
    id: number;
    bomNumber: string;
    name: string;
    version: number;
    revision: string;
    status: BomStatus;
    outputQuantity: DecimalString;
    product: ProductRef;
  };
  quantity: DecimalString;
  components: ExplodedComponent[];
  totalMaterialCost: DecimalString;
}

export interface BomCostRollup {
  bomId: number;
  materialCost: DecimalString;
  laborCost: DecimalString;
  overheadCost: DecimalString;
  totalUnitCost: DecimalString;
  lines: Array<{
    productId: number;
    productCode: string;
    productName: string;
    quantityPerUnit: DecimalString;
    unitCost: DecimalString;
    extendedCost: DecimalString;
    source: "ROLLED_UP" | "STANDARD_COST";
  }>;
  missingCosts: Array<{
    productId: number;
    productCode: string;
    productName: string;
  }>;
}

export interface BomChangeLogEntry {
  id: number;
  changeType: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  description: string;
  reason: string | null;
  createdAt: string;
  changedBy: UserRef;
}

export interface WhereUsedResult {
  usedAsComponent: Array<{
    bomId: number;
    bomNumber: string;
    bomName: string;
    version: number;
    revision: string;
    status: BomStatus;
    parentProduct: ProductRef;
    quantity: DecimalString;
    uomCode: string | null;
    scrapPercent: DecimalString;
  }>;
  usedAsSubstitute: Array<{
    bomId: number;
    bomNumber: string;
    bomName: string;
    status: BomStatus;
    parentProduct: ProductRef;
    substitutesFor: ProductRef;
    priority: number;
    conversionFactor: DecimalString;
  }>;
}

export interface Supplier {
  id: number;
  code: string;
  name: string;
  logoUrl: string | null;
  legalName: string | null;
  status: SupplierStatus;
  email: string | null;
  phone: string | null;
  website: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  currencyCode: string;
  paymentTerms: string | null;
  creditDays: number;
  incoterms: string | null;
  leadTimeDays: number;
  minOrderValue: DecimalString | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  notes: string | null;
  isBlacklisted: boolean;
  blacklistReason: string | null;
  createdAt: string;
  contacts?: SupplierContact[];
  createdBy?: UserRef | null;
  performanceSnapshots?: SupplierPerformanceSnapshot[];
  recentOrders?: Array<{
    id: number;
    poNumber: string;
    status: PurchaseOrderStatus;
    orderDate: string;
    expectedDeliveryDate: string | null;
    grandTotal: DecimalString;
    currencyCode: string;
  }>;
  _count?: {
    purchaseOrders: number;
    supplierProducts: number;
    goodsReceiptNotes: number;
  };
}

export interface SupplierContact {
  id: number;
  supplierId: number;
  name: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export interface SupplierCatalogueEntry {
  id: number;
  supplierId: number;
  productId: number;
  supplierSku: string | null;
  unitPrice: DecimalString;
  currencyCode: string;
  minOrderQuantity: DecimalString;
  packSize: DecimalString;
  leadTimeDays: number;
  validFrom: string;
  validTo: string | null;
  isPreferred: boolean;
  isActive: boolean;
  product: ProductRef;
  priceTiers: Array<{
    id: number;
    minQuantity: DecimalString;
    unitPrice: DecimalString;
  }>;
}

export interface SupplierScorecard {
  supplierId: number;
  supplierCode: string;
  supplierName: string;
  periodStart: string;
  periodEnd: string;
  totalOrders: number;
  totalOrderValue: DecimalString;
  receiptsCount: number;
  onTimeReceipts: number;
  lateReceipts: number;
  onTimeDeliveryRate: DecimalString;
  receivedQuantity: DecimalString;
  acceptedQuantity: DecimalString;
  rejectedQuantity: DecimalString;
  qualityAcceptanceRate: DecimalString;
  averageLeadTimeDays: DecimalString;
  priceVariancePercent: DecimalString;
  fillRate: DecimalString;
  overallScore: DecimalString;
  hasData: boolean;
}

export interface SupplierPerformanceSnapshot
  extends Omit<SupplierScorecard, "supplierCode" | "supplierName" | "hasData"> {
  id: number;
  computedAt: string;
}

export interface PriceComparisonRow {
  supplier: SupplierRef & {
    status: SupplierStatus;
    leadTimeDays: number;
    paymentTerms: string | null;
  };
  supplierSku: string | null;
  unitPrice: DecimalString;
  priceSource: "PRICE_TIER" | "CATALOGUE";
  currencyCode: string;
  minOrderQuantity: DecimalString;
  packSize: DecimalString;
  leadTimeDays: number;
  isPreferred: boolean;
  extendedPrice: DecimalString;
  meetsMinimumOrder: boolean;
  priceTiers: Array<{
    id: number;
    minQuantity: DecimalString;
    unitPrice: DecimalString;
  }>;
}

export interface DeliveryWatchlistRow {
  id: number;
  poNumber: string;
  supplier: SupplierRef;
  warehouse: WarehouseRef;
  status: PurchaseOrderStatus;
  orderDate: string;
  dueDate: string | null;
  daysLate: number;
  isOverdue: boolean;
  grandTotal: DecimalString;
  orderedQuantity: DecimalString;
  receivedQuantity: DecimalString;
  outstandingQuantity: DecimalString;
  completionPercent: DecimalString;
}

export interface PurchaseRequisition {
  id: number;
  requisitionNumber: string;
  warehouseId: number;
  status: PurchaseRequisitionStatus;
  origin: string;
  requiredByDate: string | null;
  estimatedValue: DecimalString;
  justification: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  warehouse: WarehouseRef;
  suggestedSupplier: SupplierRef | null;
  requestedBy: UserRef;
  approvedBy?: UserRef | null;
  purchaseOrders?: Array<{
    id: number;
    poNumber: string;
    status: PurchaseOrderStatus;
    grandTotal: DecimalString;
  }>;
  _count?: { lines: number; purchaseOrders: number };
  lines?: PurchaseRequisitionLine[];
}

export interface PurchaseRequisitionLine {
  id: number;
  productId: number;
  quantity: DecimalString;
  orderedQuantity: DecimalString;
  estimatedUnitPrice: DecimalString;
  requiredByDate: string | null;
  notes: string | null;
  product: ProductRef;
  uom: { id: number; code: string } | null;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierId: number;
  warehouseId: number;
  requisitionId: number | null;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDeliveryDate: string | null;
  promisedDate: string | null;
  currencyCode: string;
  exchangeRate: DecimalString;
  subtotal: DecimalString;
  discountAmount: DecimalString;
  taxAmount: DecimalString;
  shippingAmount: DecimalString;
  grandTotal: DecimalString;
  paymentTerms: string | null;
  incoterms: string | null;
  shipToAddress: string | null;
  notes: string | null;
  internalNotes: string | null;
  cancellationReason: string | null;
  sentAt: string | null;
  acknowledgedAt: string | null;
  closedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  supplier: SupplierRef & {
    email: string | null;
    paymentTerms: string | null;
    leadTimeDays: number;
  };
  warehouse: WarehouseRef;
  createdBy: UserRef;
  approvedBy: UserRef | null;
  requisition: { id: number; requisitionNumber: string } | null;
  _count?: { lines: number; receipts: number };
  lines?: PurchaseOrderLine[];
  receipts?: Array<{
    id: number;
    grnNumber: string;
    status: GrnStatus;
    receivedDate: string;
    totalReceivedQuantity: DecimalString;
    totalAcceptedQuantity: DecimalString;
    totalRejectedQuantity: DecimalString;
    isOnTime: boolean | null;
  }>;
  approvals?: Array<{
    id: number;
    status: "PENDING" | "APPROVED" | "REJECTED";
    comment: string | null;
    completedDate: string | null;
    createdAt: string;
    requestedTo: UserRef;
    createdBy: UserRef;
  }>;
}

export interface PurchaseOrderLine {
  id: number;
  productId: number;
  lineNumber: number;
  description: string | null;
  quantity: DecimalString;
  unitPrice: DecimalString;
  discountPercent: DecimalString;
  taxPercent: DecimalString;
  taxAmount: DecimalString;
  lineTotal: DecimalString;
  receivedQuantity: DecimalString;
  acceptedQuantity: DecimalString;
  rejectedQuantity: DecimalString;
  expectedDate: string | null;
  status: PurchaseOrderLineStatus;
  product: ProductRef;
  uom: { id: number; code: string } | null;
}

export interface PurchasingDashboard {
  period: { from: string; to: string };
  ordersByStatus: Array<{
    status: PurchaseOrderStatus;
    count: number;
    value: DecimalString;
  }>;
  spendLast30Days: DecimalString;
  openCommitmentValue: DecimalString;
  openRequisitions: number;
  activeSuppliers: number;
  receiptsPendingQc: number;
  overdueOrders: number;
  suppliersOrderedFromLast30Days: number;
}

export interface GoodsReceipt {
  id: number;
  grnNumber: string;
  purchaseOrderId: number | null;
  supplierId: number;
  warehouseId: number;
  status: GrnStatus;
  receivedDate: string;
  supplierInvoiceNumber: string | null;
  supplierInvoiceDate: string | null;
  vehicleNumber: string | null;
  lrNumber: string | null;
  isOnTime: boolean | null;
  delayDays: number | null;
  totalReceivedQuantity: DecimalString;
  totalAcceptedQuantity: DecimalString;
  totalRejectedQuantity: DecimalString;
  totalValue: DecimalString;
  notes: string | null;
  postedAt: string | null;
  createdAt: string;
  supplier: SupplierRef;
  warehouse: WarehouseRef;
  purchaseOrder: {
    id: number;
    poNumber: string;
    status: PurchaseOrderStatus;
    promisedDate: string | null;
    expectedDeliveryDate: string | null;
  } | null;
  receivedBy: UserRef;
  _count?: { lines: number; qualityChecks: number };
  lines?: GoodsReceiptLine[];
}

export interface GoodsReceiptLine {
  id: number;
  productId: number;
  lineNumber: number;
  receivedQuantity: DecimalString;
  acceptedQuantity: DecimalString;
  rejectedQuantity: DecimalString;
  unitCost: DecimalString;
  batchNumber: string | null;
  serialNumbers: string[];
  manufacturedDate: string | null;
  expiryDate: string | null;
  qcResult: QcResult;
  rejectionReason: string | null;
  isPosted: boolean;
  product: ProductRef;
  uom: { id: number; code: string } | null;
  lot: {
    id: number;
    lotNumber: string;
    batchNumber: string | null;
    expiryDate: string | null;
  } | null;
  putawayBin: { id: number; code: string } | null;
  purchaseOrderLine: {
    id: number;
    lineNumber: number;
    quantity: DecimalString;
    receivedQuantity: DecimalString;
    unitPrice: DecimalString;
  } | null;
  qualityChecks: QualityCheck[];
}

export interface QualityCheck {
  id: number;
  qcNumber: string;
  grnId: number;
  grnLineId: number;
  sampleSize: DecimalString;
  inspectedQuantity: DecimalString;
  acceptedQuantity: DecimalString;
  rejectedQuantity: DecimalString;
  result: QcResult;
  defectType: string | null;
  remarks: string | null;
  inspectedAt: string;
  inspectedBy: UserRef;
  parameters: QualityCheckParameter[];
  grn?: {
    id: number;
    grnNumber: string;
    receivedDate: string;
    supplier: SupplierRef;
  };
  grnLine?: { id: number; product: ProductRef };
}

export interface QualityCheckParameter {
  id: number;
  parameterName: string;
  specification: string | null;
  minValue: DecimalString | null;
  maxValue: DecimalString | null;
  observedValue: string | null;
  isPassed: boolean;
}

export interface ProductionOrder {
  id: number;
  orderNumber: string;
  productId: number;
  bomId: number;
  warehouseId: number;
  status: ProductionOrderStatus;
  plannedQuantity: DecimalString;
  producedQuantity: DecimalString;
  scrappedQuantity: DecimalString;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  plannedMaterialCost: DecimalString;
  actualMaterialCost: DecimalString;
  notes: string | null;
  createdAt: string;
  product: ProductRef;
  bom: {
    id: number;
    bomNumber: string;
    version: number;
    revision: string;
    status: BomStatus;
  };
  warehouse: WarehouseRef;
  createdBy: UserRef;
  _count?: { components: number };
  components?: Array<{
    id: number;
    productId: number;
    requiredQuantity: DecimalString;
    issuedQuantity: DecimalString;
    consumedQuantity: DecimalString;
    wastedQuantity: DecimalString;
    scrapPercent: DecimalString;
    standardUnitCost: DecimalString;
    product: ProductRef;
  }>;
  consumption?: Array<{
    id: number;
    quantity: DecimalString;
    consumptionType: string;
    unitCost: DecimalString;
    totalCost: DecimalString;
    reasonCode: string | null;
    occurredAt: string;
    lot: { id: number; lotNumber: string; batchNumber: string | null };
  }>;
  materialRequisitions?: Array<{
    id: number;
    requisitionNumber: string;
    status: MaterialRequisitionStatus;
    issuedAt: string | null;
  }>;
}

export interface ProductionVariance {
  productionOrderId: number;
  orderNumber: string;
  product: ProductRef;
  bom: { id: number; bomNumber: string; version: number; revision: string };
  plannedQuantity: DecimalString;
  producedQuantity: DecimalString;
  scrappedQuantity: DecimalString;
  plannedMaterialCost: DecimalString;
  actualMaterialCost: DecimalString;
  costVariance: DecimalString;
  lines: Array<{
    productId: number;
    productCode: string;
    productName: string;
    uomCode: string | null;
    requiredQuantity: DecimalString;
    issuedQuantity: DecimalString;
    consumedQuantity: DecimalString;
    wastedQuantity: DecimalString;
    varianceQuantity: DecimalString;
    variancePercent: DecimalString;
    standardUnitCost: DecimalString;
    varianceValue: DecimalString;
  }>;
}
