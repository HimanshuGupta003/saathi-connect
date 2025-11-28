import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { sendTestNotification } from "../controllers/notificationController.js";

const router = Router();

router.post("/test", authMiddleware, sendTestNotification);

export default router;
