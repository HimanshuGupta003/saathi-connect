import { Router } from "express";
const router = Router();
import { getAllZones } from "../controllers/zoneController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";

router.get(
  "/",
  authMiddleware,
  roleMiddleware(["super-admin", "admin"]),
  getAllZones
);

export default router;
