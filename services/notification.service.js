import admin from "firebase-admin";
import User from "../models/User.model.js";
import i18n from "../config/i18n.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase service account from Render secret file or local config
let serviceAccount;
const renderSecretPath = "/etc/secrets/serviceAccountKey.json";
const localPath = path.join(__dirname, "../config/serviceAccountKey.json");

if (fs.existsSync(renderSecretPath)) {
  // Running on Render - use secret file
  serviceAccount = JSON.parse(fs.readFileSync(renderSecretPath, "utf8"));
  console.log("📁 Loaded Firebase credentials from Render secret file");
} else if (fs.existsSync(localPath)) {
  // Running locally - use local config
  serviceAccount = JSON.parse(fs.readFileSync(localPath, "utf8"));
  console.log("📁 Loaded Firebase credentials from local config");
} else {
  console.error("❌ Firebase serviceAccountKey.json not found!");
  process.exit(1);
}

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
