import { sendPushNotification } from "../services/notification.service.js";

export async function sendTestNotification(req, res) {
  try {
    await sendPushNotification({
      userId: req.user.id,
      titleKey: "notification_assignment_title",
      bodyKey: "notification_assignment_body",
      placeholders: { assignmentType: "department" },
      data: { reportId: "demo" },
    });
    res.status(200).json({ message: "Test notification dispatched (if token is registered)." });
  } catch (e) {
    res.status(500).json({ message: "Failed to send test notification.", error: e?.message || e });
  }
}
