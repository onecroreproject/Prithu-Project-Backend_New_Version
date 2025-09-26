const admin = require('firebase-admin');
const serviceAccount = require('../FCMKEY/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
