import cron from "node-cron";
import Report from "../models/Report.model.js";

const checkSlaBreaches = async () => {
  console.log("🕒 Running SLA Tracker Job...");
  try {
    const now = new Date();
    const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    const reportsToEscalate = await Report.find({
      createdAt: { $lte: seventyTwoHoursAgo },
      status: { $nin: ["Resolved", "Rejected"] },
      priority: { $ne: "Critical" },
    });

    if (reportsToEscalate.length > 0) {
      console.log(
        `🔥 Found ${reportsToEscalate.length} reports breaching SLA. Escalating priority to Critical.`
      );

      const reportIds = reportsToEscalate.map((report) => report._id);

      await Report.updateMany(
        { _id: { $in: reportIds } },
        { $set: { priority: "Critical" } }
      );
    } else {
      console.log("✅ No SLA breaches found.");
    }
  } catch (error) {
    console.error("❌ Error in SLA Tracker Job:", error);
  }
};

export const startSlaTracker = () => {
  cron.schedule("0 * * * *", checkSlaBreaches);
  console.log("⏰ SLA Tracker Job has been scheduled to run every hour.");
};
export default { startSlaTracker };
