import { Router } from "express";
import { AccountController } from "../controllers/accounts.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();
const accountController = new AccountController();

router.use(requireAuth, requirePermission("accounts.view"));

router.get("/getAllAccounts", accountController.getAllAccounts);

router.get("/getDetails/:accountId", accountController.getAccountDetails);

router.get(
  "/:accountId/contacts/search",
  accountController.searchAccountContacts
);

router.get("/search", accountController.searchAccounts);

router.put(
  "/:id",
  requirePermission("accounts.manage"),
  accountController.updateAccount
);

export default router;
