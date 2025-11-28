import Report from "../models/Report.model.js";

export async function getPublicStats(req, res) {
  try {
    const [totalReports, resolvedReports, totalFunds] = await Promise.all([
      Report.countDocuments(),
      Report.countDocuments({ status: "Resolved" }),
      Report.aggregate([
        { $match: { status: "Resolved" } },
        { $group: { _id: null, total: { $sum: "$fundsAllocated" } } },
      ]),
    ]);

    const stats = {
      totalReports: totalReports,
      resolvedReports: resolvedReports,
      pendingReports: totalReports - resolvedReports,
      resolutionRate:
        totalReports > 0 ? (resolvedReports / totalReports) * 100 : 0,
      totalFundsUtilized: totalFunds.length > 0 ? totalFunds[0].total : 0,
    };

    res.status(200).json(stats);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

export async function getCategoryCounts(req, res) {
  try {
    const counts = await Report.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $project: { _id: 0, category: "$_id", count: 1 } },
      { $sort: { count: -1 } },
    ]);
    res.status(200).json(counts);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

// Public: Zone leaderboard (by total reports with resolved and resolution rate)
export async function getZoneLeaderboard(req, res) {
  try {
    const data = await Report.aggregate([
      { $match: { zone: { $ne: null } } },
      {
        $group: {
          _id: "$zone",
          total: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: "zones",
          localField: "_id",
          foreignField: "_id",
          as: "zone",
        },
      },
      {
        $project: {
          _id: 0,
          zoneId: "$_id",
          zoneName: {
            $ifNull: [{ $arrayElemAt: ["$zone.name", 0] }, "Unknown"],
          },
          total: 1,
          resolved: 1,
          resolutionRate: {
            $cond: [
              { $gt: ["$total", 0] },
              { $multiply: [{ $divide: ["$resolved", "$total"] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { total: -1 } },
    ]);
    res.status(200).json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

// Public: Trends for last N days (default 30) - submissions vs resolutions per day
export async function getPublicTrends(req, res) {
  try {
    const timezone = "Asia/Kolkata";
    const days = Math.min(
      Math.max(parseInt(req.query.period || "30", 10), 1),
      90
    );

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));

    // Group submissions by createdAt day
    const submitted = await Report.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone },
          },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, date: "$_id", count: 1 } },
    ]);

    // Group resolutions by updatedAt day where status is Resolved
    const resolved = await Report.aggregate([
      { $match: { updatedAt: { $gte: startDate }, status: "Resolved" } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$updatedAt", timezone },
          },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, date: "$_id", count: 1 } },
    ]);

    // Fill missing days with 0
    const dateMapSubmitted = Object.fromEntries(
      submitted.map((d) => [d.date, d.count])
    );
    const dateMapResolved = Object.fromEntries(
      resolved.map((d) => [d.date, d.count])
    );
    const seriesDates = [];
    const submissions = [];
    const resolutions = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const key = d.toLocaleDateString("en-CA", { timeZone: timezone });
      seriesDates.push(key);
      submissions.push(dateMapSubmitted[key] || 0);
      resolutions.push(dateMapResolved[key] || 0);
    }

    res.status(200).json({ dates: seriesDates, submissions, resolutions });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}
