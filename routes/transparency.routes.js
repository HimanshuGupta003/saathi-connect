import { Router } from "express";
const router = Router();
import {
  getPublicStats,
  getCategoryCounts,
  getZoneLeaderboard,
  getPublicTrends,
} from "../controllers/transparencyController.js";

router.get("/stats", getPublicStats);
router.get("/categories", getCategoryCounts);
router.get("/zones", getZoneLeaderboard);
router.get("/trends", getPublicTrends);

export default router;
