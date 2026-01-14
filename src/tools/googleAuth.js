import { google } from "googleapis";
import { GoogleToken } from "../db/models/GoogleToken.js";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.modify",
];

// ------------------------
// Create OAuth2 client
// ------------------------
export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// ------------------------
// Generate consent URL
// ------------------------
export function getAuthUrl() {
  const oAuth2Client = getOAuthClient();
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // ensures refresh token
  });
}

// ------------------------
// Save tokens to DB
// ------------------------
export async function saveTokens(userId, code) {
  const oAuth2Client = getOAuthClient();
  const { tokens } = await oAuth2Client.getToken(code);

  console.log("✅ Tokens fetched from Google:", tokens);

  const dbData = {
    userId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    scope: tokens.scope,
    tokenType: tokens.token_type,
    // Store as bigint (milliseconds), NOT as ISO string
    expiryDate: tokens.expiry_date ? Number(tokens.expiry_date) : null,
  };

  await GoogleToken.upsert(dbData);
  console.log("✅ Tokens saved successfully for user:", userId);

  return tokens;
}


// ------------------------
// Get authorized client
// ------------------------
export async function getAuthorizedClient(userId) {
  const tokenData = await GoogleToken.findOne({ where: { userId } });
  if (!tokenData) throw new Error("No token found. User must authorize first.");

  const oAuth2Client = getOAuthClient();

  oAuth2Client.setCredentials({
    access_token: tokenData.accessToken,
    refresh_token: tokenData.refreshToken,
    scope: tokenData.scope,
    token_type: tokenData.tokenType,
    expiry_date: tokenData.expiryDate
      ? new Date(tokenData.expiryDate).getTime()
      : null,
  });

  return oAuth2Client;
}

