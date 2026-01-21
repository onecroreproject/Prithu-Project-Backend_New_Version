const { google } = require('googleapis');
const fs = require('fs');
// YOUR CONFIG FROM .env (decoded)
const GDRIVE_CLIENT_SECRET_BASE64 = "eyJ3ZWIiOnsiY2xpZW50X2lkIjoiNjI1NzgyMjcwOTAyLTlzb201MmUzcTAxcG00dGE1NnQzNTlicmRpNWJxZ3VkLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwicHJvamVjdF9pZCI6ImR1bGNldC1wb3N0LTQ4MzgwNS1xNSIsImF1dGhfdXJpIjoiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tL28vb2F1dGgyL2F1dGgiLCJ0b2tlbl91cmkiOiJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS90b2tlbiIsImF1dGhfcHJvdmlkZXJfeDUwOV9jZXJ0X3VybCI6Imh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL29hdXRoMi92MS9jZXJ0cyIsImNsaWVudF9zZWNyZXQiOiJHT0NTUFgtbHY2STN6eFQySnprcVBGM3pLdmE4VFlmX2pZSiIsInJlZGlyZWN0X3VyaXMiOlsiaHR0cDovL2xvY2FsaG9zdCJdfX0=";
const credentials = JSON.parse(
  Buffer.from(GDRIVE_CLIENT_SECRET_BASE64, 'base64').toString('utf8')
);
const { client_id, client_secret, redirect_uris } = credentials.web;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
// 1. Generate Auth URL
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline', // IMPORTANT: This ensures you get a refresh token
  prompt: 'consent',     // IMPORTANT: This forces Google to show the consent screen again
  scope: ['https://www.googleapis.com/auth/drive'],
});
console.log('--- STEP 1: AUTHORIZE ---');
console.log('Open this URL in your browser:\n', authUrl);
console.log('\n--- STEP 2: GET CODE ---');
console.log('After authorizing, you will be redirected to a page (likely localhost).');
console.log('Copy the "code" parameter from the URL.');
console.log('Example: http://localhost/?code=4/0AdQt8... -> Your code is "4/0AdQt8..."');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

readline.question('\nEnter the code from that URL: ', async (code) => {
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    console.log('\n--- STEP 3: SUCCESS ---');
    console.log('New tokens obtained!');
    
    const base64Token = Buffer.from(JSON.stringify(tokens)).toString('base64');
    console.log('\n--- YOUR NEW GDRIVE_TOKEN_BASE64 ---');
    console.log(base64Token);
    console.log('\nCopy this value and update your .env file.');
  } catch (err) {
    console.error('Error retrieving access token', err.message);
  }
  readline.close();
});