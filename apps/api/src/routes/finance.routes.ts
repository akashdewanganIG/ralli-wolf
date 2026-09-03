import { Router } from "express";

import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";
import { FinanceController } from "../controllers/finance.controller.js";
import { PlanningController } from "../controllers/planning.controller.js";

const finance = new FinanceController();
const planning = new PlanningController();

export const financeRouter = Router();
financeRouter.use(requireAuth, requirePermission("finance.view"));

financeRouter.get("/dashboard", finance.dashboard.bind(finance));

financeRouter.get("/uninvoiced", finance.uninvoiced.bind(finance));

financeRouter.get("/payables", finance.listPayables.bind(finance));
financeRouter.post(
  "/payables",
  requirePermission("finance.manage"),
  finance.createPayable.bind(finance)
);
financeRouter.patch(
  "/payables/:id/approve",
  requirePermission("finance.manage"),
  finance.approvePayable.bind(finance)
);

financeRouter.get("/receivables", finance.listReceivables.bind(finance));
financeRouter.post(
  "/receivables",
  requirePermission("finance.manage"),
  finance.createReceivable.bind(finance)
);

financeRouter.get("/payments", finance.listPayments.bind(finance));
financeRouter.post(
  "/payments",
  requirePermission("finance.manage"),
  finance.recordPayment.bind(finance)
);

export const planningRouter = Router();
planningRouter.use(requireAuth, requirePermission("production.view"));

planningRouter.get("/board", planning.board.bind(planning));

planningRouter.get("/capacity", planning.capacityLoad.bind(planning));

planningRouter.get("/work-centers", planning.listWorkCenters.bind(planning));
planningRouter.post(
  "/work-centers",
  requirePermission("production.manage"),
  planning.createWorkCenter.bind(planning)
);

planningRouter.get(
  "/boms/:bomId/operations",
  planning.listBomOperations.bind(planning)
);
planningRouter.post(
  "/boms/:bomId/operations",
  requirePermission("production.manage"),
  planning.addBomOperation.bind(planning)
);
planningRouter.patch(
  "/boms/:bomId/operations/:operationId",
  requirePermission("production.manage"),
  planning.updateBomOperation.bind(planning)
);
planningRouter.delete(
  "/boms/:bomId/operations/:operationId",
  requirePermission("production.manage"),
  planning.deleteBomOperation.bind(planning)
);

planningRouter.get(
  "/orders/:id/operations",
  planning.orderOperations.bind(planning)
);
planningRouter.post(
  "/orders/:id/schedule",
  requirePermission("production.manage"),
  planning.scheduleOrder.bind(planning)
);
