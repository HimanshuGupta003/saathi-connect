import admin from "firebase-admin";
import User from "../models/User.model.js";
import i18n from "../config/i18n.js";
import serviceAccount from "../config/serviceAccountKey.json" with { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

console.log("✅ Firebase Admin SDK initialized successfully.");

export async function sendPushNotification({
  userId,
  titleKey,
  bodyKey,
  placeholders = {},
  data = {},
}) {
  try {
    const user = await User.findById(userId).select(
      "fcmToken preferredLanguage"
    );

    if (!user || !user.fcmToken) {
      console.warn(
        `User ${userId} not found or has no FCM token. Skipping notification.`
      );
      return;
    }

    const locale = user.preferredLanguage || "en";

    const title = i18n.__({ phrase: titleKey, locale }, placeholders);
    const body = i18n.__({ phrase: bodyKey, locale }, placeholders);

    const message = {
      notification: { title, body },
      token: user.fcmToken,
      data: data,
    };

  const response = await admin.messaging().send(message);
    console.log(
      `🚀 Successfully sent localized push notification to user ${userId} in '${locale}':`,
      response
    );
  } catch (error) {
    if (error.code === "messaging/registration-token-not-registered") {
      console.warn(
        `FCM token for user ${userId} is no longer valid. Consider removing it.`
      );
    } else {
      console.error("❌ Error sending push notification:", error);
    }
  }
}
