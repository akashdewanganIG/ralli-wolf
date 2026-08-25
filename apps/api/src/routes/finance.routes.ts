import { Router } from "express";
import { UserRole } from "@prisma/client";

import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { FinanceController } from "../controllers/finance.controller.js";
import { PlanningController } from "../controllers/planning.controller.js";

const finance = new FinanceController();
const planning = new PlanningController();

/**
 * Finance and planning are back-office functions, guarded exactly as the rest
 * of the supply chain is. What the business owes, is owed, and is building is
 * not readable by every account that happens to be logged in.
 */
const guard = [requireAuth, requireRole([UserRole.ADMIN])];

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------
export const financeRouter = Router();
financeRouter.use(...guard);

// GET  /api/finance/dashboard      payables, receivables, ageing, cash flow
financeRouter.get("/dashboard", finance.dashboard.bind(finance));

// GET  /api/finance/uninvoiced     documents that can be billed but have not been
financeRouter.get("/uninvoiced", finance.uninvoiced.bind(finance));

// Accounts payable
financeRouter.get("/payables", finance.listPayables.bind(finance));
financeRouter.post("/payables", finance.createPayable.bind(finance));
financeRouter.patch(
  "/payables/:id/approve",
  finance.approvePayable.bind(finance)
);

// Accounts receivable
financeRouter.get("/receivables", finance.listReceivables.bind(finance));
financeRouter.post("/receivables", finance.createReceivable.bind(finance));

// Payments
financeRouter.get("/payments", finance.listPayments.bind(finance));
financeRouter.post("/payments", finance.recordPayment.bind(finance));

// ---------------------------------------------------------------------------
// Production planning
// ---------------------------------------------------------------------------
export const planningRouter = Router();
planningRouter.use(...guard);

// GET  /api/planning/board          orders waiting to be scheduled, and scheduled ones
planningRouter.get("/board", planning.board.bind(planning));

// GET  /api/planning/capacity       load vs capacity per work centre per day
planningRouter.get("/capacity", planning.capacityLoad.bind(planning));

// Work centres
planningRouter.get("/work-centers", planning.listWorkCenters.bind(planning));
planningRouter.post("/work-centers", planning.createWorkCenter.bind(planning));

// Routing on a bill of materials
planningRouter.get(
  "/boms/:bomId/operations",
  planning.listBomOperations.bind(planning)
);
planningRouter.post(
  "/boms/:bomId/operations",
  planning.addBomOperation.bind(planning)
);

// Scheduling a production order across its routing
planningRouter.get(
  "/orders/:id/operations",
  planning.orderOperations.bind(planning)
);
planningRouter.post(
  "/orders/:id/schedule",
  planning.scheduleOrder.bind(planning)
);
