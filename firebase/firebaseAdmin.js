const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath = path.resolve(process.env.FCM_SERVICE_ACCOUNT);
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  httpAgentOptions: {
    keepAlive: true,  // prevents gRPC EOF errors
    timeout: 60000,   // increase timeout
  },
});

module.exports = admin;
