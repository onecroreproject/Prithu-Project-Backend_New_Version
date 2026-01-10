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
const code = "4/0ASc3gC0yPf28ltH2igUWtyhURSIbRZVrTMLmOQjzw3s-Gq8BwGk8AyMEDP2qEfTmob26bw";

oAuth2Client.getToken(code, (err, token) => {
  if (err) {
    console.error("Error getting token:", err);
    return;
  }

  fs.writeFileSync("token.json", JSON.stringify(token));
  console.log("✅ Token stored in token.json");
});
