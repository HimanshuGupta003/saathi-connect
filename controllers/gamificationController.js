import User from "../models/User.model.js";
import Report from "../models/Report.model.js";
import badgesConfig from "../config/badges.config.js";

const POINTS_CONFIG = {
  NEW_REPORT: 20,
  UPVOTE_REPORT: 5,
  REPORT_RESOLVED: 50,
};

export async function getAllBadges(req, res) {
  try {
    res.json(badgesConfig);
  } catch (err) {
    res.status(500).send("Server Error");
  }
}

export async function getMyProfile(req, res) {
  try {
    const userProfile = await User.findById(req.user.id).select("-password");
    if (!userProfile) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(userProfile);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

export async function getLeaderboard(req, res) {
  try {
    const users = await User.find({ role: "citizen" })
      .sort({ points: -1 })
      .limit(10)
      .select("name points avatarUrl")
      .lean();

    const leaderboard = await Promise.all(
      users.map(async (user) => {
        const reportsSubmitted = await Report.countDocuments({
          submittedBy: user._id,
        });
        return { ...user, reportsSubmitted };
      })
    );

    res.json(leaderboard);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

export async function getMyStats(req, res) {
  try {
    const userId = req.user.id;
    const [userProfile, totalReports, resolvedReports] = await Promise.all([
      User.findById(userId).select("name points avatarUrl").lean(),
      Report.countDocuments({ submittedBy: userId }),
      Report.countDocuments({ submittedBy: userId, status: "Resolved" }),
    ]);

    if (!userProfile) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      name: userProfile.name,
      points: userProfile.points,
      avatarUrl: userProfile.avatarUrl,
      totalReports,
      resolvedReports,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

export async function getMyRank(req, res) {
  try {
    const userId = req.user.id;
    const currentUser = await User.findById(userId).select("points").lean();
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }
    const higherRankedUsers = await User.countDocuments({
      points: { $gt: currentUser.points },
      role: "citizen",
    });
    const rank = higherRankedUsers + 1;
    res.json({
      rank,
      points: currentUser.points,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}

export async function addPointsForAction(userId, actionType) {
  const pointsToAdd = POINTS_CONFIG[actionType];
  if (!pointsToAdd || !userId) {
    console.error(
      `Invalid action or missing userId. Action: ${actionType}, UserID: ${userId}`
    );
    return;
  }
  try {
    await User.findByIdAndUpdate(userId, { $inc: { points: pointsToAdd } });
    console.log(
      `✅ Awarded ${pointsToAdd} points to user ${userId} for action ${actionType}.`
    );
  } catch (error) {
    console.error(`❌ Failed to add points for user ${userId}:`, error);
  }
}
