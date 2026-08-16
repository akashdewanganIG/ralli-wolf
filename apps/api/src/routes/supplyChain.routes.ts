import { Router } from "express";
import type { Request } from "express";
import multer from "multer";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { WarehouseController } from "../controllers/warehouse.controller.js";
import { InventoryController } from "../controllers/inventory.controller.js";
import { MaterialController } from "../controllers/material.controller.js";
import { WmsController } from "../controllers/wms.controller.js";
import { BomController } from "../controllers/bom.controller.js";
import { SupplierController } from "../controllers/supplier.controller.js";
import { PurchasingController } from "../controllers/purchasing.controller.js";
import { GoodsReceiptController } from "../controllers/goodsReceipt.controller.js";
import { ProductionController } from "../controllers/production.controller.js";

const warehouse = new WarehouseController();
const inventory = new InventoryController();
const material = new MaterialController();
const wms = new WmsController();
const bom = new BomController();
const supplier = new SupplierController();
const purchasing = new PurchasingController();
const goodsReceipt = new GoodsReceiptController();
const production = new ProductionController();
const warehouseImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile?: boolean) => void
  ) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error("Warehouse images must be JPEG, PNG, or WebP files"));
  },
});

/**
 * Every supply-chain route requires an authenticated ADMIN.
 * SALES users work through the CRM's sales screens; they do not post stock.
 */
const guard = [requireAuth, requireRole([UserRole.ADMIN])];

/** /api/warehouses */
export const warehouseRouter = Router();
warehouseRouter.use(...guard);
warehouseRouter.get("/", warehouse.list.bind(warehouse));
warehouseRouter.post(
  "/",
  warehouseImageUpload.array("images", 8),
  warehouse.create.bind(warehouse)
);
warehouseRouter.put("/bins/:binId", warehouse.updateBin.bind(warehouse));
warehouseRouter.patch(
  "/pallets/:palletId/move",
  warehouse.movePallet.bind(warehouse)
);
warehouseRouter.delete(
  "/images/:imageId",
  warehouse.deleteImage.bind(warehouse)
);
warehouseRouter.get("/:id", warehouse.getById.bind(warehouse));
warehouseRouter.put("/:id", warehouse.update.bind(warehouse));
warehouseRouter.post(
  "/:id/images",
  warehouseImageUpload.array("images", 8),
  warehouse.addImages.bind(warehouse)
);
warehouseRouter.get("/:id/zones", warehouse.listZones.bind(warehouse));
warehouseRouter.post("/:id/zones", warehouse.createZone.bind(warehouse));
warehouseRouter.get("/:id/bins", warehouse.listBins.bind(warehouse));
warehouseRouter.post("/:id/bins", warehouse.createBin.bind(warehouse));
warehouseRouter.post("/:id/bins/bulk", warehouse.generateBins.bind(warehouse));
warehouseRouter.get("/:id/utilisation", warehouse.utilisation.bind(warehouse));
warehouseRouter.get("/:id/pallets", warehouse.listPallets.bind(warehouse));
warehouseRouter.post("/:id/pallets", warehouse.createPallet.bind(warehouse));

/** /api/inventory */
export const inventoryRouter = Router();
inventoryRouter.use(...guard);
inventoryRouter.get("/dashboard", inventory.dashboard.bind(inventory));
inventoryRouter.get("/valuation", inventory.valuation.bind(inventory));
inventoryRouter.get("/units", inventory.listUnits.bind(inventory));
inventoryRouter.get("/stock", inventory.listStock.bind(inventory));
inventoryRouter.get(
  "/stock/:productId",
  inventory.getProductStock.bind(inventory)
);
inventoryRouter.get("/movements", inventory.listMovements.bind(inventory));
inventoryRouter.get("/lots", inventory.listLots.bind(inventory));
inventoryRouter.post("/receipts", inventory.createReceipt.bind(inventory));
inventoryRouter.post(
  "/adjustments",
  inventory.createAdjustment.bind(inventory)
);
inventoryRouter.post("/transfers", inventory.createTransfer.bind(inventory));
inventoryRouter.get("/alerts", inventory.listAlerts.bind(inventory));
inventoryRouter.post(
  "/alerts/evaluate",
  inventory.evaluateAlerts.bind(inventory)
);
inventoryRouter.patch(
  "/alerts/:id/acknowledge",
  inventory.acknowledgeAlert.bind(inventory)
);
inventoryRouter.patch(
  "/alerts/:id/resolve",
  inventory.resolveAlert.bind(inventory)
);
inventoryRouter.get(
  "/reorder-rules",
  inventory.listReorderRules.bind(inventory)
);
inventoryRouter.put(
  "/reorder-rules",
  inventory.upsertReorderRule.bind(inventory)
);
inventoryRouter.delete(
  "/reorder-rules/:id",
  inventory.deleteReorderRule.bind(inventory)
);
inventoryRouter.get("/counts", inventory.listCounts.bind(inventory));
inventoryRouter.post("/counts", inventory.createCount.bind(inventory));
inventoryRouter.get("/counts/:id", inventory.getCount.bind(inventory));
inventoryRouter.patch(
  "/counts/:id/lines",
  inventory.recordCountLines.bind(inventory)
);
inventoryRouter.post("/counts/:id/post", inventory.postCount.bind(inventory));

/** /api/materials */
export const materialRouter = Router();
materialRouter.use(...guard);
materialRouter.get("/", material.list.bind(material));
materialRouter.post("/availability", material.availability.bind(material));
materialRouter.get("/consumption", material.consumption.bind(material));
materialRouter.get("/shortages", material.shortages.bind(material));
materialRouter.get("/requisitions", material.listRequisitions.bind(material));
materialRouter.post("/requisitions", material.createRequisition.bind(material));
materialRouter.get("/requisitions/:id", material.getRequisition.bind(material));
materialRouter.post(
  "/requisitions/:id/issue",
  material.issueRequisition.bind(material)
);
materialRouter.patch(
  "/requisitions/:id/cancel",
  material.cancelRequisition.bind(material)
);

/** /api/wms */
export const wmsRouter = Router();
wmsRouter.use(...guard);
wmsRouter.get("/dashboard", wms.dashboard.bind(wms));
wmsRouter.get("/putaway-suggestions", wms.putawaySuggestions.bind(wms));
wmsRouter.get("/putaway-tasks", wms.listPutawayTasks.bind(wms));
wmsRouter.patch("/putaway-tasks/:id/assign", wms.assignPutawayTask.bind(wms));
wmsRouter.post("/putaway-tasks/:id/complete", wms.completePutaway.bind(wms));
wmsRouter.get("/pick-lists", wms.listPickLists.bind(wms));
wmsRouter.post("/pick-lists", wms.createPickList.bind(wms));
wmsRouter.get("/pick-lists/:id", wms.getPickList.bind(wms));
wmsRouter.patch("/pick-lists/:id/release", wms.releasePickList.bind(wms));
wmsRouter.patch("/pick-lists/:id/cancel", wms.cancelPickList.bind(wms));
wmsRouter.post("/pick-lists/:id/packages", wms.createPackage.bind(wms));
wmsRouter.post("/pick-lists/:id/ship", wms.ship.bind(wms));
wmsRouter.post("/pick-tasks/:id/confirm", wms.confirmPick.bind(wms));
wmsRouter.get("/packages", wms.listPackages.bind(wms));

/** /api/boms */
export const bomRouter = Router();
bomRouter.use(...guard);
bomRouter.get("/", bom.list.bind(bom));
bomRouter.post("/", bom.create.bind(bom));
bomRouter.get("/where-used/:productId", bom.whereUsed.bind(bom));
bomRouter.put("/components/:componentId", bom.updateComponent.bind(bom));
bomRouter.delete("/components/:componentId", bom.removeComponent.bind(bom));
bomRouter.post(
  "/components/:componentId/substitutes",
  bom.addSubstitute.bind(bom)
);
bomRouter.delete("/substitutes/:substituteId", bom.removeSubstitute.bind(bom));
bomRouter.get("/:id", bom.getById.bind(bom));
bomRouter.put("/:id", bom.update.bind(bom));
bomRouter.patch("/:id/status", bom.changeStatus.bind(bom));
bomRouter.post("/:id/components", bom.addComponent.bind(bom));
bomRouter.post("/:id/components/bulk", bom.replaceComponents.bind(bom));
bomRouter.get("/:id/explode", bom.explode.bind(bom));
bomRouter.post("/:id/cost-rollup", bom.costRollup.bind(bom));
bomRouter.post("/:id/revise", bom.revise.bind(bom));
bomRouter.get("/:id/history", bom.history.bind(bom));

/** /api/suppliers */
export const supplierRouter = Router();
supplierRouter.use(...guard);
supplierRouter.get("/", supplier.list.bind(supplier));
supplierRouter.post("/", supplier.create.bind(supplier));
supplierRouter.get("/scorecards", supplier.scorecards.bind(supplier));
supplierRouter.get(
  "/delivery-watchlist",
  supplier.deliveryWatchlist.bind(supplier)
);
supplierRouter.get(
  "/price-comparison/:productId",
  supplier.priceComparison.bind(supplier)
);
supplierRouter.delete(
  "/contacts/:contactId",
  supplier.removeContact.bind(supplier)
);
supplierRouter.delete(
  "/catalogue/:entryId",
  supplier.removeCatalogueEntry.bind(supplier)
);
supplierRouter.get("/:id", supplier.getById.bind(supplier));
supplierRouter.put("/:id", supplier.update.bind(supplier));
supplierRouter.post("/:id/contacts", supplier.addContact.bind(supplier));
supplierRouter.get("/:id/catalogue", supplier.listCatalogue.bind(supplier));
supplierRouter.post(
  "/:id/catalogue",
  supplier.upsertCatalogueEntry.bind(supplier)
);
supplierRouter.get("/:id/performance", supplier.performance.bind(supplier));
supplierRouter.post(
  "/:id/performance/snapshot",
  supplier.snapshotPerformance.bind(supplier)
);

/** /api/purchase-requisitions */
export const purchaseRequisitionRouter = Router();
purchaseRequisitionRouter.use(...guard);
purchaseRequisitionRouter.get(
  "/",
  purchasing.listRequisitions.bind(purchasing)
);
purchaseRequisitionRouter.post(
  "/",
  purchasing.createRequisition.bind(purchasing)
);
purchaseRequisitionRouter.get(
  "/:id",
  purchasing.getRequisition.bind(purchasing)
);
purchaseRequisitionRouter.patch(
  "/:id/status",
  purchasing.setRequisitionStatus.bind(purchasing)
);
purchaseRequisitionRouter.post(
  "/:id/convert",
  purchasing.convertRequisition.bind(purchasing)
);

/** /api/purchase-orders */
export const purchaseOrderRouter = Router();
purchaseOrderRouter.use(...guard);
purchaseOrderRouter.get("/dashboard", purchasing.dashboard.bind(purchasing));
purchaseOrderRouter.get("/", purchasing.listOrders.bind(purchasing));
purchaseOrderRouter.post("/", purchasing.createOrder.bind(purchasing));
purchaseOrderRouter.get("/:id", purchasing.getOrder.bind(purchasing));
purchaseOrderRouter.put("/:id", purchasing.updateOrder.bind(purchasing));
purchaseOrderRouter.post(
  "/:id/submit",
  purchasing.submitForApproval.bind(purchasing)
);
purchaseOrderRouter.patch(
  "/:id/status",
  purchasing.setOrderStatus.bind(purchasing)
);

/** /api/goods-receipts */
export const goodsReceiptRouter = Router();
goodsReceiptRouter.use(...guard);
goodsReceiptRouter.get(
  "/quality-checks",
  goodsReceipt.listQualityChecks.bind(goodsReceipt)
);
goodsReceiptRouter.post(
  "/lines/:lineId/quality-check",
  goodsReceipt.createQualityCheck.bind(goodsReceipt)
);
goodsReceiptRouter.get("/", goodsReceipt.list.bind(goodsReceipt));
goodsReceiptRouter.post("/", goodsReceipt.create.bind(goodsReceipt));
goodsReceiptRouter.get("/:id", goodsReceipt.getById.bind(goodsReceipt));
goodsReceiptRouter.post("/:id/post", goodsReceipt.post.bind(goodsReceipt));
goodsReceiptRouter.patch("/:id/cancel", goodsReceipt.cancel.bind(goodsReceipt));

/** /api/production-orders */
export const productionRouter = Router();
productionRouter.use(...guard);
productionRouter.get("/", production.list.bind(production));
productionRouter.post("/", production.create.bind(production));
productionRouter.get("/:id", production.getById.bind(production));
productionRouter.get(
  "/:id/availability",
  production.availability.bind(production)
);
productionRouter.post("/:id/release", production.release.bind(production));
productionRouter.post("/:id/complete", production.complete.bind(production));
productionRouter.patch("/:id/cancel", production.cancel.bind(production));
productionRouter.get("/:id/variance", production.variance.bind(production));
