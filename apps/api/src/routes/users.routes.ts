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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (
    _req: Request,
    file: { originalname: string; mimetype: string },
    cb: (error: Error | null, acceptFile: boolean) => void
  ) => {
    const ext = file.originalname
      .toLowerCase()
      .slice(file.originalname.lastIndexOf("."));
    const allowedMimesByExtension: Record<string, string[]> = {
      ".csv": ["text/csv", "application/csv", "application/vnd.ms-excel"],
      ".xlsx": [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
    };

    if (allowedMimesByExtension[ext]?.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and Excel files are allowed"), false);
    }
  },
});

router.use(requireAuth);
router.use(requirePermission("users.manage"));

router.get("/", userController.getAllUsers);

router.post("/", userController.createUser);

router.post("/import", (req, res) => userController.importUsers(req, res));

router.post("/import/file", upload.single("file"), (req, res) =>
  userController.importUsersFile(req, res)
);

router.get("/import/template", (req, res) =>
  userController.getImportTemplate(req, res)
);

router.get("/import/template/download", (req, res) =>
  userController.downloadTemplate(req, res)
);

router.get("/import/template/download/csv", (req, res) =>
  userController.downloadTemplateCsv(req, res)
);

router.post("/:id/resend-credentials", (req, res) =>
  userController.resendCredentials(req, res)
);

router.get("/:id", userController.getUserById);

router.put("/:id", userController.updateUser);

router.delete("/:id", userController.deleteUser);

export default router;
