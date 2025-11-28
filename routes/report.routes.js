import { Router } from "express";
const router = Router();
import {
  createReport,
  createAnonymousReport,
  getReportsFeed,
  getMyReports,
  getAllReports,
  upvoteReport,
  updateReportStatus,
  assignReport,
  updateReportDetails,
  syncOfflineReports,
  getReportById,
  getMyAssignedReports,
  getMapReports,
} from "../controllers/reportController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

router.get("/feed", getReportsFeed);
router.get("/map", getMapReports);
router.post("/anonymous", upload.single("image"), createAnonymousReport);
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["citizen"]),
  upload.single("image"),
  createReport
);
router.get(
  "/my-reports",
  authMiddleware,
  roleMiddleware(["citizen"]),
  getMyReports
);
router.post(
  "/sync",
  authMiddleware,
  roleMiddleware(["citizen"]),
  syncOfflineReports
);

router.get(
  "/all",
  authMiddleware,
  roleMiddleware(["admin", "subhead"]),
  getAllReports
);
router.get(
  "/my-tasks",
  authMiddleware,
  roleMiddleware(["worker"]),
  getMyAssignedReports
);

router.get("/:id", getReportById);
router.get(
  "/:id",
  authMiddleware,
  roleMiddleware(["admin", "subhead", "worker"]),
  getReportById
);
router.post(
  "/:id/upvote",
  authMiddleware,
  roleMiddleware(["citizen"]),
  upvoteReport
);
router.patch(
  "/:id/status",
  authMiddleware,
  roleMiddleware(["admin", "subhead", "worker"]),
  upload.single("proofImage"),
  updateReportStatus
);
router.patch(
  "/:id/assign",
  authMiddleware,
  roleMiddleware(["admin", "subhead"]),
  assignReport
);
router.patch(
  "/:id/details",
  authMiddleware,
  roleMiddleware(["admin", "subhead", "worker"]),
  upload.single("proofImage"),
  updateReportDetails
);

export default router;
