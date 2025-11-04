const admin = require("firebase-admin");

try {
  console.log("🚀 Initializing Firebase Admin from .env");

  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!base64) throw new Error("❌ Missing FIREBASE_SERVICE_ACCOUNT in environment");

  // Decode Base64-encoded service account JSON
  const decoded = Buffer.from(base64, "base64").toString("utf8");
  const serviceAccount = JSON.parse(decoded);

  // Fix escaped newline issue in private key
  if (serviceAccount.private_key.includes("\\n")) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  // Initialize Firebase Admin SDK
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  console.log("✅ Firebase Admin initialized successfully");
} catch (error) {
  console.error("🔥 Firebase initialization failed:", error.message);
  process.exit(1);
}

module.exports = admin;
