import User from "../models/User.model.js";
import Report from "../models/Report.model.js";

const checkAndAwardBadges = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const userBadges = new Set(user.badges.map((b) => b.name));
    let wasUpdated = false;

    const [
      totalReportCount,
      upvoteCount,
      potholeCount,
      garbageCount,
      streetlightCount,
      resolvedCount,
      trendsetterReport,
    ] = await Promise.all([
      Report.countDocuments({ submittedBy: userId }),
      Report.countDocuments({ upvotedBy: userId }),
      Report.countDocuments({ submittedBy: userId, category: "Pothole" }),
      Report.countDocuments({ submittedBy: userId, category: "Garbage" }),
      Report.countDocuments({ submittedBy: userId, category: "Streetlight" }),
      Report.countDocuments({ submittedBy: userId, status: "Resolved" }),
    ]);

    if (totalReportCount >= 1 && !userBadges.has("First Report")) {
      user.badges.push({ name: "First Report" });
      wasUpdated = true;
    }
    if (upvoteCount >= 1 && !userBadges.has("First Upvote")) {
      user.badges.push({ name: "First Upvote" });
      wasUpdated = true;
    }
    if (upvoteCount >= 10 && !userBadges.has("Community Helper")) {
      user.badges.push({ name: "Community Helper" });
      wasUpdated = true;
    }
    if (potholeCount >= 5 && !userBadges.has("Pothole Patriot")) {
      user.badges.push({ name: "Pothole Patriot" });
      wasUpdated = true;
    }
    if (garbageCount >= 5 && !userBadges.has("Sanitation Sentinel")) {
      user.badges.push({ name: "Sanitation Sentinel" });
      wasUpdated = true;
    }
    if (streetlightCount >= 5 && !userBadges.has("Light Bringer")) {
      user.badges.push({ name: "Light Bringer" });
      wasUpdated = true;
    }
    if (resolvedCount >= 5 && !userBadges.has("Civic Champion")) {
      user.badges.push({ name: "Civic Champion" });
      wasUpdated = true;
    }
    if (resolvedCount >= 10 && !userBadges.has("Problem Solver")) {
      user.badges.push({ name: "Problem Solver" });
      wasUpdated = true;
    }

    const highestUpvotedReport = await Report.findOne({
      submittedBy: userId,
    }).sort({ upvotes: -1 });
    if (
      highestUpvotedReport &&
      highestUpvotedReport.upvotes >= 10 &&
      !userBadges.has("Trendsetter")
    ) {
      user.badges.push({ name: "Trendsetter" });
      wasUpdated = true;
    }

    if (wasUpdated) {
      await user.save();
      console.log(`🏅 Badges updated for user ${userId}`);
    }
  } catch (error) {
    console.error("Error in badge service:", error);
  }
};

export default { checkAndAwardBadges };
