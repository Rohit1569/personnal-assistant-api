import express from "express";
import { getAuthUrl, saveTokens, getOAuthClient } from "../tools/googleAuth.js";

const router = express.Router();

// Step 1: Redirect to Google consent
router.get("/google", (req, res) => {
  try {
    const url = getAuthUrl();
    res.redirect(url);
  } catch (err) {
    console.error("Error generating auth URL:", err);
    res.status(500).send("Failed to generate Google auth URL");
  }
});

// Step 2: Callback after user authorizes
router.get("/google/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("No authorization code provided");
  }

  try {
    // Exchange code for tokens using the saveTokens function
    const tokens = await saveTokens("frontend-user", code);
    
    console.log(`✅ Tokens obtained for frontend`);
    console.log("Token scopes:", tokens.scope);

    // Redirect to frontend with token data encoded in URL
    // Calculate expires_in from expiry_date if not provided
    const expiresIn = tokens.expires_in || (tokens.expiry_date ? Math.round((tokens.expiry_date - Date.now()) / 1000) : 3600);
    
    console.log(`📊 Token Debug - expires_in: ${tokens.expires_in}, expiry_date: ${tokens.expiry_date}, calculated expiresIn: ${expiresIn}`);
    
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: expiresIn,
      scope: tokens.scope,
      token_type: tokens.token_type
    };
    
    console.log(`📦 Final tokenData being sent to frontend:`, tokenData);
    
    // Encode token data as base64
    const encodedTokens = Buffer.from(JSON.stringify(tokenData)).toString("base64");
    res.redirect(`${process.env.FRONTEND_URL}/callback?tokens=${encodedTokens}`);
  } catch (err) {
    console.error("Error saving tokens:", err);
    res.status(500).send("Failed to save Google tokens");
  }
});

// Step 3: Refresh token endpoint
router.post("/refresh-token", async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: "Refresh token required" });
  }

  try {
    const oAuth2Client = getOAuthClient();
    oAuth2Client.setCredentials({ refresh_token });
    
    const { credentials } = await oAuth2Client.refreshAccessToken();
    
    console.log("✅ Token refreshed successfully");

    res.json({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || refresh_token,
      expires_in: credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600,
      scope: credentials.scope,
      token_type: "Bearer"
    });
  } catch (err) {
    console.error("Token refresh error:", err);
    res.status(400).json({ error: "Failed to refresh token" });
  }
});

export default router;
