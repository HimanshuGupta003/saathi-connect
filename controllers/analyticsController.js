import { Types } from "mongoose";
import Department from "../models/Department.model.js";
import Report from "../models/Report.model.js";
import { Parser } from "json2csv";
import { getReportsAsGeoJson } from "../services/gis.service.js";

const getZoneMatchQuery = async (user) => {
  if (!user.zone) {
    return {};
  }
  const departmentsInZone = await Department.find({ zone: user.zone }).select(
    "_id"
  );
  const departmentIds = departmentsInZone.map((d) => d._id);
  return { zone: user.zone };
};

export async function getDashboardStats(req, res) {
  try {
    const { departmentId } = req.query;
    const matchQuery = await getZoneMatchQuery(req.user);
    if (departmentId) {
      matchQuery.assignedDepartment = new Types.ObjectId(departmentId);
    }
    const [statusCounts, categoryCounts, avgResolutionTime] = await Promise.all(
      [
        Report.aggregate([
          { $match: matchQuery },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Report.aggregate([
          {
            $match: {
              ...matchQuery,
              status: { $nin: ["Resolved", "Rejected"] },
            },
          },
          { $group: { _id: "$category", count: { $sum: 1 } } },
        ]),
        Report.aggregate([
          { $match: { ...matchQuery, status: "Resolved" } },
          {
            $project: {
              resolutionTime: { $subtract: ["$updatedAt", "$createdAt"] },
            },
          },
          { $group: { _id: null, avgTime: { $avg: "$resolutionTime" } } },
        ]),
      ]
    );
    const avgTimeInDays =
      avgResolutionTime.length > 0
        ? avgResolutionTime[0].avgTime / (1000 * 60 * 60 * 24)
        : 0;
    res.status(200).json({
      statusCounts,
      categoryCounts,
      averageResolutionTimeDays: parseFloat(avgTimeInDays.toFixed(2)),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

export async function getDepartmentPerformance(req, res) {
  try {
    const matchQuery = await getZoneMatchQuery(req.user);
    const performanceData = await Report.aggregate([
      {
        $match: {
          ...matchQuery,
          status: "Resolved",
          assignedDepartment: { $exists: true },
        },
      },
      { $group: { _id: "$assignedDepartment", resolvedCount: { $sum: 1 } } },
      {
        $lookup: {
          from: "departments",
          localField: "_id",
          foreignField: "_id",
          as: "department",
        },
      },
      {
        $project: {
          _id: 0,
          departmentId: { $arrayElemAt: ["$department._id", 0] },
          departmentName: { $arrayElemAt: ["$department.name", 0] },
          resolvedCount: 1,
        },
      },
      { $sort: { resolvedCount: -1 } },
    ]);
    res.status(200).json(performanceData);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

export async function getHeatmapData(req, res) {
  try {
    const { priority, status } = req.query;
    const query = await getZoneMatchQuery(req.user);
    if (status === "Active") {
      query.status = { $nin: ["Resolved", "Rejected"] };
    } else if (status === "Resolved") {
      query.status = "Resolved";
    }
    if (priority && priority !== "All Priorities") {
      query.priority = priority;
    }
    const geoJsonData = await getReportsAsGeoJson(query);
    res.status(200).json(geoJsonData);
  } catch (err) {
    console.error("Error in getHeatmapData:", err.message);
    res.status(500).send("Server Error");
  }
}

export async function exportReportsCsv(req, res) {
  try {
    const matchQuery = await getZoneMatchQuery(req.user);
    const reports = await Report.find(matchQuery)
      .lean()
      .populate("submittedBy", "name email")
      .populate("assignedDepartment", "name")
      .populate("assignedWorker", "name");

    if (reports.length === 0) {
      return res.status(404).json({ message: "No reports to export." });
    }

    const fields = [
      { label: "Report ID", value: "_id" },
      { label: "Description", value: "description" },
      { label: "Category", value: "category" },
      { label: "Status", value: "status" },
      { label: "Priority", value: "priority" },
      { label: "Upvotes", value: "upvotes" },
      { label: "Date Submitted", value: "createdAt" },
      { label: "Date Resolved", value: "updatedAt" },
      { label: "Submitter Name", value: "submittedBy.name" },
      { label: "Assigned Department", value: "assignedDepartment.name" },
      { label: "Assigned Department", value: "assignedDepartment.name" },
      { label: "Assigned Worker", value: "assignedWorker.name" },
      { label: "Address", value: "address.street" },
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(reports);

    res.header("Content-Type", "text/csv");
    res.attachment("civic-reports.csv");
    res.status(200).send(csv);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

export async function exportGisData(req, res) {
  try {
    const matchQuery = await getZoneMatchQuery(req.user);
    const geoJsonData = await getReportsAsGeoJson();
    if (!geoJsonData) {
      return res
        .status(404)
        .json({ message: "No reports available to generate GIS data." });
    }
    res.status(200).json(geoJsonData);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

export function getWeatherAlert(req, res) {
  if (global.weatherAlertStatus) {
    res.status(200).json(global.weatherAlertStatus);
  } else {
    res
      .status(200)
      .json({ active: false, message: "Status not available yet." });
  }
}

export async function getDashboardTrends(req, res) {
  try {
    const matchQuery = await getZoneMatchQuery(req.user);
    const timezone = "Asia/Kolkata";
    const todayString = new Date().toLocaleDateString("en-CA", {
      timeZone: timezone,
    });
    const newTodayResult = await Report.aggregate([
      {
        $project: {
          createdDate: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: timezone,
            },
          },
        },
      },
      {
        $match: {
          createdDate: todayString,
        },
      },
      {
        $count: "count",
      },
    ]);

    const newToday = newTodayResult.length > 0 ? newTodayResult[0].count : 0;
    const now = new Date();
    const last30DaysStart = new Date(new Date().setDate(now.getDate() - 30));
    const last60DaysStart = new Date(new Date().setDate(now.getDate() - 60));

    const last30DaysStats = await Report.aggregate([
      { $match: { createdAt: { $gte: last30DaysStart } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] },
          },
          avgTime: { $avg: { $subtract: ["$updatedAt", "$createdAt"] } },
        },
      },
    ]);

    const previous30DaysStats = await Report.aggregate([
      {
        $match: { createdAt: { $gte: last60DaysStart, $lt: last30DaysStart } },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] },
          },
          avgTime: { $avg: { $subtract: ["$updatedAt", "$createdAt"] } },
        },
      },
    ]);

    const currentPeriod = last30DaysStats[0] || {
      total: 0,
      resolved: 0,
      avgTime: 0,
    };
    const previousPeriod = previous30DaysStats[0] || {
      total: 0,
      resolved: 0,
      avgTime: 0,
    };

    const currentRate =
      currentPeriod.total > 0
        ? (currentPeriod.resolved / currentPeriod.total) * 100
        : 0;
    const previousRate =
      previousPeriod.total > 0
        ? (previousPeriod.resolved / previousPeriod.total) * 100
        : 0;
    const rateChange = currentRate - previousRate;

    const currentTimeDays = currentPeriod.avgTime / (1000 * 60 * 60 * 24);
    const previousTimeDays = previousPeriod.avgTime / (1000 * 60 * 60 * 24);
    const timeChange = currentTimeDays - previousTimeDays;

    res.status(200).json({
      resolutionRateChange: rateChange.toFixed(1),
      avgResponseTimeChange: timeChange.toFixed(1),
      newReportsToday: newToday,
    });
  } catch (err) {
    console.error("Error fetching trend data:", err.message);
    res.status(500).send("Server Error");
  }
}
