import GoogleAccount from "../db/models/GoogleAccount.js";
import { oauth2Client } from "./googleClient.js";

export async function getAuthorizedClient(userId) {
  const account = await GoogleAccount.findOne({ where: { userId } });

  if (!account) throw new Error("Google not connected");

  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: new Date(account.expiry).getTime(),
  });

  return oauth2Client;
}
