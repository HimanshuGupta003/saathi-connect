import user from "../models/User.model.js";
import Report from "../models/Report.model.js";
import Department from "../models/Department.model.js";
import Zone from "../models/Zone.model.js";
import cloudinary from "../config/cloudinary.js";
import { addPointsForAction } from "./gamificationController.js";
import { sendPushNotification } from "../services/notification.service.js";
import mongoose from "mongoose";
import badgeSvc from "../services/badge.service.js";
const { checkAndAwardBadges: serviceCheckAndAwardBadges } = badgeSvc;

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "civic-reports" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function findDepartmentForCategory(
  zoneId,
  category,
  aiPredictedCategory
) {
  const normalizedCategory = (category || "").trim();
  const normalizedAi = (aiPredictedCategory || "").trim();

  let dept = await Department.findOne({
    zone: zoneId,
    categories: {
      $elemMatch: {
        $regex: new RegExp(`^${escapeRegex(normalizedCategory)}$`, "i"),
      },
    },
  });

  if (
    !dept &&
    normalizedAi &&
    normalizedAi.toLowerCase() !== normalizedCategory.toLowerCase()
  ) {
    dept = await Department.findOne({
      zone: zoneId,
      categories: {
        $elemMatch: {
          $regex: new RegExp(`^${escapeRegex(normalizedAi)}$`, "i"),
        },
      },
    });
  }
  return dept;
}

export async function createReport(req, res) {
  try {
    const {
      description,
      latitude,
      longitude,
      category,
      address,
      aiAnalyzed,
      aiPredictedCategory,
      aiSource,
      aiConfidence,
      locationAuthenticity,
    } = req.body;
    if (!req.file || !description || !latitude || !longitude || !category) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const uploadResult = await uploadToCloudinary(req.file.buffer);
    let parsedAddress = {};
    try {
      parsedAddress = JSON.parse(address);
    } catch (e) {
      parsedAddress = { street: address || "" };
    }

    const newReport = new Report({
      description,
      category,
      address: parsedAddress,
      imageUrl: uploadResult.secure_url,
      submittedBy: req.user.id,
      location: {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
      history: [
        {
          status: "Pending",
          updatedBy: req.user.id,
          notes: "Report submitted by citizen.",
        },
      ],
      upvotedBy: [req.user.id],
      locationAuthenticity: locationAuthenticity,
      aiAnalyzed: aiAnalyzed === "true" || aiAnalyzed === true,
      aiPredictedCategory: aiPredictedCategory || undefined,
      aiSource: aiSource || undefined,
      aiConfidence: aiConfidence ? Number(aiConfidence) : undefined,
    });
    await newReport.save();

    await addPointsForAction(req.user.id, "NEW_REPORT");
    await serviceCheckAndAwardBadges(req.user.id);

    const targetZone = await Zone.findOne({
      geometry: { $geoIntersects: { $geometry: newReport.location } },
    });
    if (targetZone) {
      newReport.zone = targetZone._id;
      const targetDepartment = await findDepartmentForCategory(
        targetZone._id,
        category,
        aiPredictedCategory
      );

      if (targetDepartment) {
        newReport.assignedDepartment = targetDepartment._id;
        newReport.status = "AssignedToDept";
        newReport.history.push({
          status: "AssignedToDept",
          updatedBy: null,
          notes: `Automatically routed to ${targetDepartment.name}.`,
        });
      } else {
        newReport.category = "Unclassified";
        newReport.history.push({
          status: "Pending",
          updatedBy: null,
          notes: `Automatic routing failed. Original category was "${category}". Awaiting manual review.`,
        });
      }
    } else {
      console.info("Auto-routing: No zone contains point", {
        coordinates: newReport.location.coordinates,
      });
    }

    // Save first so notification errors cannot block persistence
    await newReport.save();

    const io = req.app.get('socketio');
    const populatedReport = await Report.findById(newReport._id)
                                        .populate("assignedDepartment", "name")
                                        .populate("assignedWorker", "name email")
                                        .lean();

    // Emit a specific event for report creation
    io.emit('report:created', populatedReport);

    // Send push notification AFTER save (and don’t block if it fails)
    if (newReport.submittedBy && newReport.assignedDepartment) {
      try {
        await sendPushNotification({
          userId: newReport.submittedBy.toString(),
          titleKey: "notification_assignment_title",
          bodyKey: "notification_assignment_body",
          placeholders: { assignmentType: "department" },
          data: { reportId: newReport._id.toString() },
        });
      } catch (e) {
        console.warn("sendPushNotification failed:", e?.message || e);
      }
    }

    await addPointsForAction(req.user.id, "NEW_REPORT");
    await serviceCheckAndAwardBadges(req.user.id);
    res
      .status(201)
      .json({ message: "Report submitted successfully.", report: newReport });
  } catch (err) {
    console.error("CREATE REPORT ERROR:", err);
    res.status(500).send("Server Error");
  }
}

export async function createAnonymousReport(req, res) {
  try {
    const {
      description,
      latitude,
      longitude,
      category,
      address,
      aiAnalyzed,
      aiPredictedCategory,
      aiSource,
      aiConfidence,
      locationAuthenticity,
    } = req.body;

    if (!req.file)
      return res.status(400).json({ message: "Please upload an image." });

    // Mirror required-field checks from authenticated path
    if (!description || !latitude || !longitude || !category) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const uploadResult = await uploadToCloudinary(req.file.buffer);

    // Robust address parsing
    let parsedAddress = {};
    try {
      parsedAddress = address ? JSON.parse(address) : {};
    } catch {
      parsedAddress = { street: address || "" };
    }

    const newReport = new Report({
      description,
      category,
      address: parsedAddress,
      imageUrl: uploadResult.secure_url,
      isAnonymous: true,
      location: {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
      history: [{ status: "Pending", notes: "Report submitted anonymously." }],
      locationAuthenticity: locationAuthenticity,
      aiAnalyzed: aiAnalyzed === "true" || aiAnalyzed === true,
      aiPredictedCategory: aiPredictedCategory || undefined,
      aiSource: aiSource || undefined,
      aiConfidence: aiConfidence ? Number(aiConfidence) : undefined,
    });

    await newReport.save();

    // Auto-route anonymous reports
    const targetZone = await Zone.findOne({
      geometry: { $geoIntersects: { $geometry: newReport.location } },
    });

    if (targetZone) {
      newReport.zone = targetZone._id;

      const targetDepartment = await findDepartmentForCategory(
        targetZone._id,
        category,
        aiPredictedCategory
      );

      if (targetDepartment) {
        newReport.assignedDepartment = targetDepartment._id;
        newReport.status = "AssignedToDept";
        newReport.history.push({
          status: "AssignedToDept",
          updatedBy: null,
          notes: `Automatically routed to ${targetDepartment.name}.`,
        });
      } else {
        newReport.category = "Unclassified";
        newReport.history.push({
          status: "Pending",
          updatedBy: null,
          notes: `Automatic routing failed. Original category was "${category}". Awaiting manual review.`,
        });
      }
    } else {
      console.info("Auto-routing (anonymous): No zone contains point", {
        coordinates: newReport.location.coordinates,
      });
    }

    await newReport.save();

    return res.status(201).json({
      message: "Anonymous report submitted successfully.",
      report: newReport,
    });
  } catch (err) {
    console.error("CREATE ANON REPORT ERROR:", err);
    res.status(500).send("Server Error");
  }
}

export async function getReportsFeed(req, res) {
  try {
    const {
      latitude,
      longitude,
      maxDistance = 5000,
      category,
      sortBy = "distance",
    } = req.query;

    if (!latitude || !longitude) {
      return res
        .status(400)
        .json({ message: "Latitude and longitude are required." });
    }

    const pipeline = [
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          distanceField: "distance",
          maxDistance: parseInt(maxDistance, 10),
          query: { status: { $ne: "Resolved" } },
          spherical: true,
        },
      },
    ];

    if (category) {
      pipeline.push({ $match: { category: category } });
    }

    if (sortBy === "recent") {
      pipeline.push({ $sort: { createdAt: -1 } });
    } else if (sortBy === "popular") {
      pipeline.push({ $sort: { upvotes: -1 } });
    }

    pipeline.push({ $limit: 50 });

    const reports = await Report.aggregate(pipeline);
    res.status(200).json(reports);
  } catch (err) {
    console.error("GET REPORTS FEED ERROR:", err);
    res.status(500).send("Server Error");
  }
}

export async function getMapReports(req, res) {
  try {
    const { swLat, swLng, neLat, neLng } = req.query;
    if (!swLat || !swLng || !neLat || !neLng)
      return res.status(400).json({ message: "Map boundaries are required." });

    const reports = await Report.find({
      location: {
        $geoWithin: {
          $box: [
            [parseFloat(swLng), parseFloat(swLat)],
            [parseFloat(neLng), parseFloat(neLat)],
          ],
        },
      },
      status: { $ne: "Resolved" },
    }).limit(200);
    res.json(reports);
  } catch (err) {
    console.error("CRITICAL ERROR in getMapReports:", err);
    res.status(500).send("Server Error");
  }
}

export async function getMyReports(req, res) {
  try {
    const reports = await Report.find({ submittedBy: req.user.id }).sort({
      createdAt: -1,
    });
    res.status(200).json(reports);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

export async function upvoteReport(req, res) {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found." });

    if (report.upvotedBy.some((userId) => userId.equals(req.user.id))) {
      return res
        .status(400)
        .json({ message: "You have already upvoted this report." });
    }

    report.upvotedBy.push(req.user.id);
    report.upvotes = report.upvotedBy.length;
    await report.save();

    await addPointsForAction(req.user.id, "UPVOTE_REPORT");
    await serviceCheckAndAwardBadges(req.user.id);
    if (report.submittedBy) {
      await serviceCheckAndAwardBadges(report.submittedBy.toString());
    }

    res.status(200).json({
      message: "Report upvoted successfully.",
      upvotes: report.upvotes,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

export async function getReportById(req, res) {
  try {
    const report = await Report.findById(req.params.id)
      .populate("submittedBy", "name email avatarUrl")
      .populate("assignedDepartment", "name")
      .populate("assignedWorker", "name")
      .populate("history.updatedBy", "name role");

    if (!report) return res.status(404).json({ message: "Report not found" });
    res.status(200).json(report);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

export async function getAllReports(req, res) {
  try {
    const { status, priority, category, assignedDepartment, date } = req.query;
    let query = {};
    if (req.user.zone) {
      query.zone = req.user.zone;
    }
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedDepartment) query.assignedDepartment = assignedDepartment;
    if (category) query.category = { $regex: category, $options: "i" };
    if (date) {
      const startDate = new Date(date);
      startDate.setUTCHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setUTCHours(23, 59, 59, 999);
      query.createdAt = { $gte: startDate, $lte: endDate };
    }
    const reports = await Report.find(query)
      .populate("assignedDepartment", "name")
      .populate("assignedWorker", "name")
      .sort({ createdAt: -1 });
    res.status(200).json(reports);
  } catch (err) {
    console.error("Error in getAllReports:", err.message);
    res.status(500).send("Server Error");
  }
}

export async function assignReport(req, res) {
  try {
    const { departmentId, workerId } = req.body;
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found." });

    let historyEntry = { updatedBy: req.user.id };
    let newStatus = report.status;

    // if (req.user.role === "admin" && departmentId) {
    //   report.assignedDepartment = departmentId;
    //   newStatus = "AssignedToDept";
    //   historyEntry.notes = `Assigned to department by Admin.`;
    // } else if (
    //   (req.user.role === "subhead" || req.user.role === "admin") &&
    //   workerId
    // ) {
    //   report.assignedWorker = workerId;
    //   newStatus = "AssignedToWorker";
    //   historyEntry.notes = `Assigned to worker.`;
    // } else {
    //   return res.status(400).json({ message: "Invalid assignment request." });
    // }
    if (departmentId) {
      report.assignedDepartment = departmentId;
      newStatus = "AssignedToDept";
      historyEntry.notes = `Assigned to department by Admin.`;
    } else if (workerId) {
      report.assignedWorker = workerId;
      newStatus = "AssignedToWorker";
      historyEntry.notes = `Assigned to worker.`;
    } else {
      return res.status(400).json({ message: "Invalid assignment request." });
    }

    report.status = newStatus;
    historyEntry.status = newStatus;
    report.history.push(historyEntry);
    await report.save();

    const io = req.app.get('socketio');
    const populatedReport = await Report.findById(report._id)
                                        .populate("assignedDepartment", "name")
                                        .populate("assignedWorker", "name email")
                                        .lean();
    if (workerId) {
        io.emit('report:assignedToWorker', populatedReport);
    } else {
        // If assigned to a department, it's like a new report for that dept
        io.emit('report:created', populatedReport);
    }

    if (report.submittedBy) {
      await sendPushNotification({
        userId: report.submittedBy.toString(),
        titleKey: "notification_status_updated_title",
        bodyKey: "notification_status_updated_body",
        placeholders: { status: newStatus, category: report.category },
        data: { reportId: report._id.toString() },
      });
    }
    res.status(200).json({ message: "Report assigned successfully.", report: populatedReport  });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

export async function updateReportStatus(req, res) {
  try {
    const { status, notes } = req.body;
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found." });

    const originalStatus = report.status;
    report.status = status;

    const historyEntry = {
      status: status,
      updatedBy: req.user.id,
      notes: notes || `Status updated to ${status}.`,
    };
    report.history.push(historyEntry);
    await report.save();

    if (report.submittedBy) {
      await sendPushNotification({
        userId: report.submittedBy.toString(),
        titleKey: "notification_status_updated_title",
        bodyKey: "notification_status_updated_body",
        placeholders: { status: report.status, category: report.category },
        data: { reportId: report._id.toString() },
      });

      if (status === "Resolved" && originalStatus !== "Resolved") {
        await addPointsForAction(
          report.submittedBy.toString(),
          "REPORT_RESOLVED"
        );
        await serviceCheckAndAwardBadges(report.submittedBy.toString());
      }
    }
    res.status(200).json({ message: "Report status updated.", report });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

export async function getMyAssignedReports(req, res) {
  try {
    const { status } = req.query;
    const query = { assignedWorker: req.user.id };

    if (status === "completed") {
      query.status = { $in: ["Resolved", "Rejected"] };
    } else {
      query.status = { $nin: ["Resolved", "Rejected"] };
    }
    const reports = await Report.find(query).sort({
      priority: -1,
      createdAt: -1,
    });
    res.status(200).json(reports);
  } catch (err) {
    console.error("Error in getMyAssignedReports:", err.message);
    res.status(500).send("Server Error");
  }
}

export async function updateReportDetails(req, res) {
  try {
    const { fundsAllocated, priority, rejectionReason, notes } = req.body;
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found." });

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer);
      const lastHistoryEntry = report.history[report.history.length - 1];
      if (lastHistoryEntry) {
        lastHistoryEntry.proofImageUrl = uploadResult.secure_url;
      }
    }

    if (req.user.role === "worker") {
      if (!req.file) {
        return res
          .status(400)
          .json({ message: "Proof of work image is required." });
      }
      const uploadResult = await uploadToCloudinary(req.file.buffer);
      report.status = "Resolved";
      report.history.push({
        status: "Resolved",
        updatedBy: req.user.id,
        notes: notes || "Task marked as resolved by worker.",
        proofImageUrl: uploadResult.secure_url,
      });

      if (report.submittedBy) {
        await addPointsForAction(
          report.submittedBy.toString(),
          "REPORT_RESOLVED"
        );
      }
    }

    if (req.user.role === "admin" || req.user.role === "subhead") {
      if (fundsAllocated) {
        report.fundsAllocated = fundsAllocated;
        report.history.push({
          status: report.status,
          updatedBy: req.user.id,
          notes: `Funds allocated: ₹${fundsAllocated}`,
        });
      }
      if (priority) report.priority = priority;
      if (rejectionReason) report.rejectionReason = rejectionReason;
    }

    report.history.push({
      status: report.status,
      updatedBy: req.user.id,
      notes: `Details updated by Admin. Priority set to ${
        priority || report.priority
      }. Funds allocated: ₹${fundsAllocated || report.fundsAllocated}.`,
    });

    await report.save();
    res.status(200).json({ message: "Report details updated.", report });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

export async function syncOfflineReports(req, res) {
  const { reports } = req.body;

  if (!reports || !Array.isArray(reports) || reports.length === 0) {
    return res.status(400).json({ message: "No reports to sync." });
  }

  let successfulSyncs = 0;
  let failedSyncs = 0;
  const syncedReports = [];

  for (const offlineReport of reports) {
    try {
      const {
        description,
        latitude,
        longitude,
        category,
        address,
        imageBase64,
      } = offlineReport;

      if (!imageBase64 || !description || !category) {
        failedSyncs++;
        continue;
      }

      const uploadResult = await cloudinary.uploader.upload(
        `data:image/jpeg;base64,${imageBase64}`,
        {
          folder: "civic-reports",
        }
      );

      const newReport = new Report({
        description,
        category,
        address,
        imageUrl: uploadResult.secure_url,
        submittedBy: req.user.id,
        location: {
          type: "Point",
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
        },
        history: [
          {
            status: "Pending",
            updatedBy: req.user.id,
            notes: "Report submitted via offline sync.",
          },
        ],
        upvotedBy: [req.user.id],
      });

      await newReport.save();
      const io = req.app.get('socketio');
      const populatedReport = await Report.findById(newReport._id).populate(/*...*/).lean();
      io.emit('newReport', populatedReport);
      await addPointsForAction(req.user.id, "NEW_REPORT");
      successfulSyncs++;
      syncedReports.push(newReport);
    } catch (error) {
      console.error("Error syncing one report:", error);
      failedSyncs++;
    }
  }

  res.status(200).json({
    message: "Sync complete.",
    successful: successfulSyncs,
    failed: failedSyncs,
    syncedReports: syncedReports,
  });
}