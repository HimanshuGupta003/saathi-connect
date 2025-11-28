import { Router } from "express";
const router = Router();
import {
  createZone,
  createZoneAdmin,
} from "../controllers/superadminController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";

router.use(authMiddleware, roleMiddleware(["super-admin"]));

router.post("/zones", createZone);
router.post("/zone-admins", createZoneAdmin);

export default router;
