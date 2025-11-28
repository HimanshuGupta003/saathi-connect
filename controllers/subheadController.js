import Report from "../models/Report.model.js";
import User from "../models/User.model.js";
import Department from "../models/Department.model.js";
import mongoose from "mongoose";

export async function getDashboardData(req, res) {
  try {
    const subhead = req.user;
    if (!subhead.department) {
      return res
        .status(400)
        .json({ message: "Subhead is not assigned to a department." });
    }

    const deptId = subhead.department;
    const now = new Date();
    const last30Days = new Date(new Date().setDate(now.getDate() - 30));
    const last60Days = new Date(new Date().setDate(now.getDate() - 60));

    const [
      departmentDetails,
      pendingAssignmentCount,
      workerStats,
      avgResolution,
      prioritizedTasks,
      performanceData,
    ] = await Promise.all([
      Department.findById(deptId).lean(),
      Report.countDocuments({
        assignedDepartment: deptId,
        status: "AssignedToDept",
      }),
      User.aggregate([
        { $match: { department: deptId, role: "worker" } },
        {
          $lookup: {
            from: "reports",
            localField: "_id",
            foreignField: "assignedWorker",
            as: "tasks",
          },
        },
        {
          $project: {
            activeTasks: {
              $size: {
                $filter: {
                  input: "$tasks",
                  as: "task",
                  cond: {
                    $not: { $in: ["$$task.status", ["Resolved", "Rejected"]] },
                  },
                },
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            totalWorkers: { $sum: 1 },
            availableWorkers: {
              $sum: { $cond: [{ $eq: ["$activeTasks", 0] }, 1, 0] },
            },
          },
        },
      ]),
      Report.aggregate([
        { $match: { assignedDepartment: deptId, status: "Resolved" } },
        {
          $group: {
            _id: null,
            avgTime: { $avg: { $subtract: ["$updatedAt", "$createdAt"] } },
          },
        },
      ]),
      Report.find({
        assignedDepartment: deptId,
        status: "AssignedToDept",
      })
        .sort({ priority: -1, upvotes: -1, createdAt: 1 })
        .limit(10),
      Report.aggregate([
        {
          $match: {
            assignedDepartment: deptId,
            status: "Resolved",
            updatedAt: { $gte: last60Days },
          },
        },
        {
          $group: {
            _id: {
              $cond: [
                { $gte: ["$updatedAt", last30Days] },
                "current",
                "previous",
              ],
            },
            avgTime: { $avg: { $subtract: ["$updatedAt", "$createdAt"] } },
          },
        },
      ]),
    ]);

    const currentPerf = performanceData.find((p) => p._id === "current");
    const previousPerf = performanceData.find((p) => p._id === "previous");
    let improvement = 0;
    if (currentPerf && previousPerf && previousPerf.avgTime > 0) {
      const change = previousPerf.avgTime - currentPerf.avgTime;
      improvement = (change / previousPerf.avgTime) * 100;
    }

    const budget = departmentDetails?.budget || { total: 0, spent: 0 };
    const data = {
      pendingAssignment: pendingAssignmentCount,
      workersAvailable: workerStats[0]?.availableWorkers || 0,
      totalWorkers: workerStats[0]?.totalWorkers || 0,
      avgResolutionTimeDays: avgResolution[0]
        ? (avgResolution[0].avgTime / (1000 * 60 * 60 * 24)).toFixed(1)
        : "0.0",
      remainingBudget: budget.total - budget.spent,
      tasks: prioritizedTasks,
      performanceImprovement: improvement.toFixed(0),
      teamMemberCount: workerStats[0]?.totalWorkers || 0,
    };

    res.status(200).json(data);
  } catch (err) {
    console.error("Error in getDashboardData:", err.message);
    res.status(500).send("Server Error");
  }
}
