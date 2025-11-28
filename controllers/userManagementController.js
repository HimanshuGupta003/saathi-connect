import User from "../models/User.model.js";
import { genSalt, hash } from "bcryptjs";
import Report from "../models/Report.model.js";
import { Types } from "mongoose";

export async function createStaff(req, res) {
  try {
    const { name, email, password, role, departmentId } = req.body;
    const creator = await User.findById(req.user.id);

    if (creator.role !== "admin" && creator.role !== "subhead") {
      return res
        .status(403)
        .json({
          message: "Forbidden: You do not have permission to create staff.",
        });
    }
    if (role === "admin") {
      return res
        .status(400)
        .json({ message: "Admin accounts cannot be created via this route." });
    }
    if (!creator.zone) {
      return res
        .status(400)
        .json({ message: "You must be assigned to a Zone to create staff." });
    }
    if (creator.role === "subhead" && role !== "worker") {
      return res
        .status(403)
        .json({ message: "Subheads can only create Workers." });
    }
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email already exists." });
    }

    const newUser = new User({
      name,
      email,
      password,
      role,
      department: departmentId,
      zone: creator.zone,
    });

    const salt = await genSalt(10);
    newUser.password = await hash(password, salt);
    await newUser.save();

    const userResponse = newUser.toObject();
    delete userResponse.password;

    res
      .status(201)
      .json({
        message: `${role} account created successfully.`,
        user: userResponse,
      });
  } catch (err) {
    console.error("Error in createStaff:", err.message);
    res.status(500).send("Server Error");
  }
}

export async function getAllStaff(req, res) {
  try {
    const { departmentId } = req.query;
    const query = { role: { $ne: "citizen" } };

    if (req.user.zone) {
      query.zone = req.user.zone;
    }

    if (departmentId) {
      query.department = new Types.ObjectId(departmentId);
    }

    const staff = await User.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "reports",
          let: { workerId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$assignedWorker", "$$workerId"] },
                    { $not: { $in: ["$status", ["Resolved", "Rejected"]] } },
                  ],
                },
              },
            },
            { $count: "activeTasks" },
          ],
          as: "tasks",
        },
      },
      {
        $lookup: {
          from: "departments",
          localField: "department",
          foreignField: "_id",
          as: "departmentInfo",
        },
      },
      {
        $lookup: {
          from: "zones",
          localField: "zone",
          foreignField: "_id",
          as: "zoneInfo",
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          role: 1,
          department: { $arrayElemAt: ["$departmentInfo", 0] },
          activeTasks: {
            $ifNull: [{ $arrayElemAt: ["$tasks.activeTasks", 0] }, 0],
          },
          zoneName: {
            $ifNull: [{ $arrayElemAt: ["$zoneInfo.name", 0] }, "N/A"],
          }, // <-- ADD THIS LINE
        },
      },
    ]);

    res.status(200).json(staff);
  } catch (err) {
    console.error("Error in getAllStaff:", err.message);
    res.status(500).send("Server Error");
  }
}

export async function getStaffMemberDetails(req, res) {
  try {
    const staffId = req.params.id;

    const [staffMember, reportStats] = await Promise.all([
      User.findById(staffId).populate("department", "name").select("-password"),
      Report.aggregate([
        {
          $match: {
            "history.updatedBy": new Types.ObjectId(staffId),
            status: "Resolved",
          },
        },
        {
          $group: {
            _id: null,
            totalResolved: { $sum: 1 },
          },
        },
      ]),
    ]);

    if (!staffMember) {
      return res.status(404).json({ message: "Staff member not found." });
    }
    const recentResolved = await Report.find({
      "history.updatedBy": new Types.ObjectId(staffId),
      status: "Resolved",
    })
      .sort({ updatedAt: -1 })
      .limit(5);

    const stats = {
      totalListing: 1500,
      totalResolved: reportStats[0]?.totalResolved || 0,
      totalParticipation: 1250,
    };

    res.status(200).json({ staffMember, stats, recentResolved });
  } catch (err) {
    console.error("Error in getStaffMemberDetails:", err.message);
    res.status(500).send("Server Error");
  }
}

export async function updateStaff(req, res) {
  try {
    const { name, email, role, departmentId } = req.body;
    const staffToUpdate = await User.findById(req.params.id);

    if (!staffToUpdate) {
      return res.status(404).json({ message: "Staff member not found." });
    }

    if (
      req.user.zone &&
      staffToUpdate.zone &&
      staffToUpdate.zone.toString() !== req.user.zone.toString()
    ) {
      return res
        .status(403)
        .json({
          message: "Forbidden: You can only update staff in your own zone.",
        });
    }

    staffToUpdate.name = name || staffToUpdate.name;
    staffToUpdate.email = email || staffToUpdate.email;
    staffToUpdate.role = role || staffToUpdate.role;
    staffToUpdate.department = departmentId || staffToUpdate.department;

    await staffToUpdate.save();
    const userResponse = staffToUpdate.toObject();
    delete userResponse.password;

    res
      .status(200)
      .json({
        message: "Staff member updated successfully.",
        user: userResponse,
      });
  } catch (err) {
    console.error("Error in updateStaff:", err.message);
    res.status(500).send("Server Error");
  }
}

export async function deleteStaff(req, res) {
  try {
    const staffToDelete = await User.findById(req.params.id);

    if (!staffToDelete) {
      return res.status(404).json({ message: "Staff member not found." });
    }

    if (
      req.user.zone &&
      staffToDelete.zone &&
      staffToDelete.zone.toString() !== req.user.zone.toString()
    ) {
      return res
        .status(403)
        .json({
          message: "Forbidden: You can only delete staff in your own zone.",
        });
    }

    if (staffToDelete._id.toString() === req.user.id.toString()) {
      return res
        .status(400)
        .json({ message: "You cannot delete your own account." });
    }

    await staffToDelete.deleteOne();
    res.status(200).json({ message: "Staff member deleted successfully." });
  } catch (err) {
    console.error("Error in deleteStaff:", err.message);
    res.status(500).send("Server Error");
  }
}
