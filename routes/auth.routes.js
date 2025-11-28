import { Router } from "express";
const router = Router();
import passport from "passport";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  register,
  login,
  refreshToken,
  googleCallback,
  updateFcmToken,
} from "../controllers/authController.js";

router.post("/register", register);
router.post("/login", login);
router.post("/refresh-token", refreshToken);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/" }),
  googleCallback
);

router.post("/fcm-token", authMiddleware, updateFcmToken);

export default router;
