import Department from "../models/Department.model.js";
import User from "../models/User.model.js";
import mongoose from "mongoose";

export async function createDepartment(req, res) {
  try {
    const { name, categories } = req.body;
    const adminUser = await User.findById(req.user.id);

    if (!adminUser.zone) {
      return res
        .status(400)
        .json({
          message: "Admin is not assigned to a Zone. Cannot create department.",
        });
    }

    let department = await Department.findOne({
      name: name,
      zone: adminUser.zone,
    });
    if (department) {
      return res
        .status(400)
        .json({
          message: `A department named "${name}" already exists in this Zone.`,
        });
    }

    department = new Department({
      name,
      categories: categories || [],
      zone: adminUser.zone,
    });
    await department.save();
    res
      .status(201)
      .json({ message: "Department created successfully.", department });
  } catch (err) {
    console.error("Error in createDepartment:", err.message);
    res.status(500).send("Server Error");
  }
}

export async function getAllDepartments(req, res) {
  try {
    const query = {};
    if (req.user.zone) {
      query.zone = req.user.zone;
    }
    const departments = await Department.find(query)
      .populate("subhead", "name email")
      .populate("zone", "name");
    res.status(200).json(departments);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

export async function assignSubhead(req, res) {
  try {
    const { subheadId } = req.body;
    const { id: departmentId } = req.params;

    const userToAssign = await User.findById(subheadId);
    const department = await Department.findById(departmentId);

    if (!userToAssign || !department) {
      return res.status(404).json({ message: "User or Department not found." });
    }

    if (
      userToAssign.role === "subhead" &&
      userToAssign.department.toString() !== departmentId
    ) {
      return res
        .status(400)
        .json({
          message: "This user is already a subhead of another department.",
        });
    }

    department.subhead = subheadId;
    userToAssign.role = "subhead";
    userToAssign.department = departmentId;
    await department.save();
    await userToAssign.save();

    res
      .status(200)
      .json({
        message: `Successfully assigned ${userToAssign.name} as Subhead for ${department.name}.`,
      });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

export async function updateDepartment(req, res) {
  try {
    const { name, categories } = req.body;
    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(404).json({ message: "Department not found." });
    }
    if (
      req.user.zone &&
      department.zone.toString() !== req.user.zone.toString()
    ) {
      return res
        .status(403)
        .json({
          message: "Forbidden: You can only edit departments in your own zone.",
        });
    }

    department.name = name || department.name;
    department.categories = categories || department.categories;

    await department.save();
    res
      .status(200)
      .json({ message: "Department updated successfully.", department });
  } catch (err) {
    console.error("Error in updateDepartment:", err.message);
    res.status(500).send("Server Error");
  }
}

export async function getDepartmentById(req, res) {
  try {
    const department = await Department.findById(req.params.id).populate(
      "subhead",
      "name"
    );
    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }
    res.status(200).json(department);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

export async function deleteDepartment(req, res) {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(404).json({ message: "Department not found." });
    }
    if (
      req.user.zone &&
      department.zone.toString() !== req.user.zone.toString()
    ) {
      return res
        .status(403)
        .json({
          message:
            "Forbidden: You can only delete departments in your own zone.",
        });
    }

    const staffCount = await User.countDocuments({ department: req.params.id });
    if (staffCount > 0) {
      return res
        .status(400)
        .json({
          message:
            "Cannot delete department. Please re-assign all staff members first.",
        });
    }

    await department.deleteOne();
    res.status(200).json({ message: "Department deleted successfully." });
  } catch (err) {
    console.error("Error in deleteDepartment:", err.message);
    res.status(500).send("Server Error");
  }
}
