import { Router } from "express";
import { AccountController } from "../controllers/accounts.controller.js";
import { requireRole } from "../middleware/auth.middleware.js";
import { UserRole } from "@prisma/client";

const router = Router();
const accountController = new AccountController();

// GET /api/accounts/getAllAccounts
router.get("/getAllAccounts", accountController.getAllAccounts);

// GET /api/accounts/getDetails/:accountId
router.get("/getDetails/:accountId", accountController.getAccountDetails);

// GET /api/accounts/:accountId/contacts/search
router.get(
  "/:accountId/contacts/search",
  accountController.searchAccountContacts
);

// GET /api/accounts/search
router.get("/search", accountController.searchAccounts);

// PUT /api/accounts/:id (System Admin only)
router.put(
  "/:id",
  requireRole([UserRole.ADMIN]),
  accountController.updateAccount
);

export default router;
