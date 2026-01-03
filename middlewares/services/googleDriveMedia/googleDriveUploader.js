const { google } = require("googleapis");
const { Readable } = require("stream");

// 🔐 Decode service account JSON from ENV
if (!process.env.GDRIVE_SERVICE_ACCOUNT_BASE64) {
  throw new Error("GDRIVE_SERVICE_ACCOUNT_BASE64 is missing in env");
}

const serviceAccount = JSON.parse(
  Buffer.from(
    process.env.GDRIVE_SERVICE_ACCOUNT_BASE64,
    "base64"
  ).toString("utf8")
);

// 🔐 Auth using credentials (NO FILE)
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ["https://www.googleapis.com/auth/drive"]
});

const drive = google.drive({
  version: "v3",
  auth
});

exports.uploadToDrive = async (buffer, fileName, mimeType, folderId) => {
  if (!buffer || !fileName || !mimeType || !folderId) {
    throw new Error("Missing upload parameters");
  }

  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const fileRes = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId]
    },
    media: {
      mimeType,
      body: stream
    },
    supportsAllDrives: true // ✅ safe for shared drives
  });

  // 🌍 Make file public
  await drive.permissions.create({
    fileId: fileRes.data.id,
    requestBody: {
      role: "reader",
      type: "anyone"
    }
  });

  return {
    fileId: fileRes.data.id,
    url: `https://drive.google.com/uc?id=${fileRes.data.id}`
  };
};
