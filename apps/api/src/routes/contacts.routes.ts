import { Router } from "express";
import { ContactController } from "../controllers/contacts.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();
const contactController = new ContactController();

router.use(requireAuth, requirePermission("accounts.view"));

router.get("/", contactController.getAllContacts);

router.get("/search", contactController.searchContacts);

router.post(
  "/",
  requirePermission("accounts.manage"),
  contactController.createContact
);

router.get("/:id", contactController.getContactById);

router.put(
  "/:id",
  requirePermission("accounts.manage"),
  contactController.updateContact
);

export default router;
