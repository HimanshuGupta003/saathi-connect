import { Router } from "express";
const router = Router();
import {
  getDashboardStats,
  exportReportsCsv,
  exportGisData,
  getDepartmentPerformance,
  getHeatmapData,
  getWeatherAlert,
  getDashboardTrends,
} from "../controllers/analyticsController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";

const adminAndSubhead = roleMiddleware(["admin", "subhead"]);

router.get("/stats", authMiddleware, adminAndSubhead, getDashboardStats);
router.get(
  "/performance",
  authMiddleware,
  adminAndSubhead,
  getDepartmentPerformance
);
router.get("/reports-geojson", authMiddleware, adminAndSubhead, getHeatmapData);
router.get("/weather-alert", authMiddleware, adminAndSubhead, getWeatherAlert);
router.get(
  "/export-csv",
  authMiddleware,
  roleMiddleware(["admin"]),
  exportReportsCsv
);
router.get(
  "/export-gis",
  authMiddleware,
  roleMiddleware(["admin"]),
  exportGisData
);
router.get(
  "/weather-alert",
  authMiddleware,
  roleMiddleware(["admin", "subhead"]),
  getWeatherAlert
);
router.get(
  "/trends",
  authMiddleware,
  roleMiddleware(["admin"]),
  getDashboardTrends
);

export default router;
