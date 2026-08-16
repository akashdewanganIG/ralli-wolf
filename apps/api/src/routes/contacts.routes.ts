import { Router } from "express";
import { ContactController } from "../controllers/contacts.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();
const contactController = new ContactController();

// Apply authentication to ALL routes
router.use(requireAuth);

// GET /api/contacts
router.get("/", contactController.getAllContacts);

// GET /api/contacts/search
router.get("/search", contactController.searchContacts);

// POST /api/contacts
router.post("/", contactController.createContact);

// GET /api/contacts/:id
router.get("/:id", contactController.getContactById);

// PUT /api/contacts/:id
router.put("/:id", contactController.updateContact);

export default router;
