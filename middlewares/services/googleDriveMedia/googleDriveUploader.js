const { google } = require("googleapis");
const { Readable } = require("stream");
const { oAuth2Client } = require("./googleDriverAuth");

const drive = google.drive({
  version: "v3",
  auth: oAuth2Client
});

exports.uploadToDrive = async (
  buffer,
  fileName,
  mimeType,
  folderId
) => {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const fileRes = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: folderId ? [folderId] : undefined,
    },
    media: {
      mimeType,
      body: stream,
    },
  });

  const fileId = fileRes.data.id;

  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  return {
    fileId,
    url: `https://lh3.googleusercontent.com/d/${fileId}`,
  };
};

