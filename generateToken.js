const { google } = require("googleapis");
const credentials = require("./client_secret.json");

const { client_id, client_secret, redirect_uris } = credentials.web;

const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  scope: ["https://www.googleapis.com/auth/drive"],
  prompt: "consent"
});

console.log("\n🔗 Open this URL in your browser:\n");
console.log(authUrl);
