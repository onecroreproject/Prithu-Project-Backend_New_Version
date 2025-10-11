// firebaseAdmin.js
const admin = require("firebase-admin");
require('dotenv').config(); // only needed if using .env locally

let serviceAccount;

// ✅ Load service account JSON
if (process.env.FIREBASE_CONFIG) {
  // Render / production environment: parse JSON from environment variable
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
  } catch (err) {
    console.error("Failed to parse FIREBASE_CONFIG env variable:", err);
    process.exit(1);
  }
} else {
  // Local development: load from JSON file
  try {
    serviceAccount = require("./serviceAccountKey.json");
  } catch (err) {
    console.error("Local serviceAccountKey.json not found:", err);
    process.exit(1);
  }
}

// ✅ Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://prithu-app-35919.firebaseio.com" // replace with your DB URL if needed
});

console.log("Firebase Admin initialized successfully");

module.exports = admin;
