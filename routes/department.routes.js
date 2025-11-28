import { Router } from "express";
const router = Router();
import {
  createDepartment,
  getAllDepartments,
  assignSubhead,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
} from "../controllers/departmentController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";

router
  .route("/")
  .post(authMiddleware, roleMiddleware(["admin"]), createDepartment)
  .get(authMiddleware, roleMiddleware(["admin", "subhead"]), getAllDepartments);

router
  .route("/:id")
  .get(authMiddleware, roleMiddleware(["admin", "subhead"]), getDepartmentById)
  .put(authMiddleware, roleMiddleware(["admin"]), updateDepartment)
  .delete(authMiddleware, roleMiddleware(["admin"]), deleteDepartment);

router.patch(
  "/:id/assign-subhead",
  authMiddleware,
  roleMiddleware(["admin"]),
  assignSubhead
);

export default router;
