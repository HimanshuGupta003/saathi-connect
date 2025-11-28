import { Router } from "express";
const router = Router();
import {
  createStaff,
  getAllStaff,
  updateStaff,
  deleteStaff,
  getStaffMemberDetails,
} from "../controllers/userManagementController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";

router
  .route("/")
  .post(authMiddleware, roleMiddleware(["admin", "subhead"]), createStaff)
  .get(authMiddleware, roleMiddleware(["admin", "subhead"]), getAllStaff);

router
  .route("/:id")
  .get(
    authMiddleware,
    roleMiddleware(["admin", "super-admin"]),
    getStaffMemberDetails
  )
  .put(authMiddleware, roleMiddleware(["admin"]), updateStaff)
  .delete(authMiddleware, roleMiddleware(["admin"]), deleteStaff);

export default router;
