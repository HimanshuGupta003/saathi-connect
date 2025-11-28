import { Router } from "express";
const router = Router();
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getMyProfile,
  getLeaderboard,
  getMyStats,
  getMyRank,
  getAllBadges,
} from "../controllers/gamificationController.js";

router.get("/leaderboard", getLeaderboard);
router.get("/badges", getAllBadges);

router.get("/profile", authMiddleware, getMyProfile);
router.get("/my-stats", authMiddleware, getMyStats);
router.get("/my-rank", authMiddleware, getMyRank);

export default router;
