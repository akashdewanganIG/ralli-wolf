import { Router } from "express";
import multer from "multer";
import { Request } from "express";
import { UserController } from "../controllers/users.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();
const userController = new UserController();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (
    _req: Request,
    file: any,
    cb: (error: Error | null, acceptFile: boolean) => void
  ) => {
    const allowedMimes = [
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const allowedExts = [".csv", ".xlsx"];
    const ext = file.originalname
      .toLowerCase()
      .slice(file.originalname.lastIndexOf("."));

    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and Excel files are allowed"), false);
    }
  },
});

// Require authentication for all user routes
// Everything under /api/users is user administration, so one capability gate
// covers the router instead of repeating a role list on each route.
router.use(requireAuth);
router.use(requirePermission("users.manage"));

// GET /api/users
router.get("/", userController.getAllUsers);
// POST /api/users
router.post("/", userController.createUser);
// POST /api/users/import  (bulk import via JSON)
router.post("/import", (req, res) => userController.importUsers(req, res));
// POST /api/users/import/file  (bulk import via file upload)
router.post("/import/file", upload.single("file"), (req, res) =>
  userController.importUsersFile(req, res)
);
// GET /api/users/import/template -- get template info (JSON)
router.get("/import/template", (req, res) =>
  userController.getImportTemplate(req, res)
);
// GET /api/users/import/template/download -- download Excel template with picklists
router.get("/import/template/download", (req, res) =>
  userController.downloadTemplate(req, res)
);
// GET /api/users/import/template/download/csv -- download CSV template
router.get("/import/template/download/csv", (req, res) =>
  userController.downloadTemplateCsv(req, res)
);
// POST /api/users/:id/resend-credentials -- issue a new password and email it
router.post("/:id/resend-credentials", (req, res) =>
  userController.resendCredentials(req, res)
);
// GET user by id
router.get("/:id", userController.getUserById);
// PUT user by id
router.put("/:id", userController.updateUser);
// Update user permissions (remove entirely as permissions no longer exist)
// DELETE user
router.delete("/:id", userController.deleteUser);

export default router;
