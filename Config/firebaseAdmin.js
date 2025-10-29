const admin = require("firebase-admin");
const path = require("path");

try {
  // Load your Firebase service account
  const serviceAccount = require(path.join(__dirname, "../firebase/serviceAccountKey.json"));

  // 🔧 Important Fix: Convert escaped \n into real newlines
  if (serviceAccount.private_key.includes("\\n")) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  // Initialize Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("✅ Firebase Admin initialized successfully");
} catch (error) {
  console.error("❌ Firebase initialization failed:", error);
  process.exit(1);
}

module.exports = admin;
