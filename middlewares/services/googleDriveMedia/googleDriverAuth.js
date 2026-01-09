const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");

// 📄 Load OAuth credentials
const credentialsPath = path.join(
  __dirname,
  "../../../client_secret.json"
);

const tokenPath = path.join(
  __dirname,
  "../../../token.json"
);

const credentials = require(credentialsPath);
const token = require(tokenPath);

const { client_id, client_secret, redirect_uris } = credentials.web;

// 🌍 Choose redirect URI based on environment
const redirectUri =
  process.env.NODE_ENV === "production"
    ? process.env.BACKEND_URL // https://prithubackend.1croreprojects.com
    : redirect_uris[0];        // http://localhost

// 🔑 Create OAuth client
const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirectUri
);

// 🔁 Attach existing token
oAuth2Client.setCredentials(token);

// 🔄 Auto-persist refreshed tokens (VERY IMPORTANT)
oAuth2Client.on("tokens", (tokens) => {
  if (!tokens) return;

  const updatedToken = {
    ...token,
    ...tokens
  };

  fs.writeFileSync(
    tokenPath,
    JSON.stringify(updatedToken, null, 2)
  );

  console.log("🔄 Google Drive token refreshed");
});

module.exports = {
  oAuth2Client
};
