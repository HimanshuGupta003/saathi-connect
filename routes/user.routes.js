import { Router } from "express";
const router = Router();
import {
  updateUserProfile,
  getUserProfile,
  changePassword,
} from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

router.get("/me", authMiddleware, getUserProfile);
router.patch("/me", authMiddleware, upload.single("avatar"), updateUserProfile);
router.patch("/me/password", authMiddleware, changePassword);

export default router;
