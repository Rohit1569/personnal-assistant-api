import GoogleAccount from "../db/models/GoogleAccount.js";

router.post("/google/token", async (req, res) => {
  try {
    const { code } = req.body;

    const { tokens } = await oauth2Client.getToken(code);

    const expiry = new Date(Date.now() + tokens.expires_in * 1000);
    const userId = "00000000-0000-0000-0000-000000000001";

    await GoogleAccount.upsert({
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scope: tokens.scope,
      expiry,
    });

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Token exchange failed" });
  }
});
