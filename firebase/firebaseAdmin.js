const admin = require("firebase-admin");

let serviceAccount;
if (process.env.FIREBASE_CONFIG) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
  } catch (err) {
    console.error("Failed to parse FIREBASE_CONFIG:", err);
    process.exit(1);
  }
} else {
  serviceAccount = require("./serviceAccountKey.json");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  //databaseURL: "https://prithu-app-35919.firebaseio.com",
});

console.log("Firebase Admin initialized successfully");
module.exports = admin;
