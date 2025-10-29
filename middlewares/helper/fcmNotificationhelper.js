// utils/fcmHelper.js
const admin = require("firebase-admin");
const { readFileSync } = require("fs");
const path = require("path");

// Use CommonJS __dirname directly
const serviceAccountPath = path.join(__dirname, "../../firebase/serviceAccountKey.json");
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));

// Initialize Firebase Admin SDK (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// 🔹 Unified helper for Web + Android FCM
exports.sendFCMNotification = async (token, title, body, image = "") => {
  try {
    const message = {
      token,
      notification: { title, body, image },
      android: {
        priority: "high",
        notification: { sound: "default" },
      },
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          icon: image || "/logo192.png",
          vibrate: [100, 50, 100],
        },
      },
      apns: { payload: { aps: { sound: "default" } } },
    };

    await admin.messaging().send(message);
    console.log("📨 Sent notification to FCM token");
  } catch (err) {
    console.error("❌ FCM Send Error:", err.message);
  }
};
