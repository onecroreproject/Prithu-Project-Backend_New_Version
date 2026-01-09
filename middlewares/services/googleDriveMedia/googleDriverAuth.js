// const { google } = require("googleapis");

// // 🔐 Decode client secret
// if (!process.env.GDRIVE_CLIENT_SECRET_BASE64) {
//   throw new Error("Missing GDRIVE_CLIENT_SECRET_BASE64");
// }

// if (!process.env.GDRIVE_TOKEN_BASE64) {
//   throw new Error("Missing GDRIVE_TOKEN_BASE64");
// }

// const credentials = JSON.parse(
//   Buffer.from(
//     process.env.GDRIVE_CLIENT_SECRET_BASE64,
//     "base64"
//   ).toString("utf8")
// );

// const token = JSON.parse(
//   Buffer.from(
//     process.env.GDRIVE_TOKEN_BASE64,
//     "base64"
//   ).toString("utf8")
// );

// const { client_id, client_secret, redirect_uris } = credentials.web;

// // 🌍 Redirect URI (dev / prod)
// const redirectUri =
//   process.env.NODE_ENV === "production"
//     ? process.env.BACKEND_LIVE
//     : redirect_uris[0];

// // 🔑 OAuth client
// const oAuth2Client = new google.auth.OAuth2(
//   client_id,
//   client_secret,
//   redirectUri
// );

// // 🔁 Attach token
// oAuth2Client.setCredentials(token);

// // 🔄 Persist refreshed token back to ENV (OPTIONAL)
// oAuth2Client.on("tokens", (tokens) => {
//   if (tokens.refresh_token) {
//     const updated = {
//       ...token,
//       ...tokens,
//     };

//     console.log(
//       "🔄 NEW GDRIVE_TOKEN_BASE64:",
//       Buffer.from(JSON.stringify(updated)).toString("base64")
//     );

//     // ⛔ you cannot auto-write env in prod
//     // copy this value manually to secret manager
//   }
// });

// module.exports = { oAuth2Client };
