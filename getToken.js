const fs = require("fs");
const { google } = require("googleapis");
const credentials = require("./client_secret.json");

const { client_id, client_secret, redirect_uris } = credentials.web;

const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

// 🔴 PASTE CODE HERE
const code = "4/0ATX87lMuUAFhx0LxVBWxUGMJNCp7vfa2S6wJu89JZLTDyNdiHQoOLifNHFxnoHSk7HOFwg";

oAuth2Client.getToken(code, (err, token) => {
  if (err) {
    console.error("Error getting token:", err);
    return;
  }

  fs.writeFileSync("token.json", JSON.stringify(token));
  console.log("✅ Token stored in token.json");
});
