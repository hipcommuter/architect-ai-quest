// One-time helper: get an OAuth refresh token for a Google account.
//
// Run this twice locally — once signed into your personal account, once into
// your work account — and paste the printed refresh tokens into GitHub
// secrets as PERSONAL_REFRESH_TOKEN and WORK_REFRESH_TOKEN.
//
// Usage:
//   GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy node get-refresh-token.js
//
// Prereqs:
//   1. In Google Cloud Console, create an OAuth 2.0 Client ID of type
//      "Desktop app". Copy the client ID and client secret.
//   2. Add the Drive API scope to the OAuth consent screen:
//        https://www.googleapis.com/auth/drive
//      and add yourself (both accounts) as a Test User.

import http from "node:http";
import { google } from "googleapis";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in env first.");
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT);

const url = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/drive"],
});

console.log("\n1. Open this URL in a browser signed into the account you want a token for:\n");
console.log(url);
console.log("\n2. After approving, you'll be redirected to localhost. This script will print the refresh token.\n");

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, REDIRECT);
  const code = u.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("No code parameter.");
    return;
  }
  try {
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { "content-type": "text/plain" })
      .end("Got it — you can close this tab and return to your terminal.");
    if (!tokens.refresh_token) {
      console.error(
        "\nNo refresh_token returned. This usually means you've already authorized this client.\n" +
        "Revoke access at https://myaccount.google.com/permissions and run this script again."
      );
    } else {
      console.log("\n=== REFRESH TOKEN (paste this into a GitHub secret) ===\n");
      console.log(tokens.refresh_token);
      console.log("\n=======================================================\n");
    }
  } catch (e) {
    res.writeHead(500).end(`Error: ${e.message}`);
    console.error(e);
  } finally {
    server.close();
  }
});

server.listen(PORT, "127.0.0.1");
