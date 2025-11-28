import { Router } from "express";
const router = Router();
import { getDashboardData } from "../controllers/subheadController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";

router.get(
  "/dashboard",
  authMiddleware,
  roleMiddleware(["subhead"]),
  getDashboardData
);

export default router;
