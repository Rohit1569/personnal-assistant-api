import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const accountSid = process.env.EXOTEL_ACCOUNT_SID;
const apiKey = process.env.EXOTEL_API_KEY;
const apiToken = process.env.EXOTEL_API_TOKEN;
const virtualNumber = process.env.EXOTEL_VIRTUAL_NUMBER;
const backendUrl = process.env.BACKEND_URL;

/**
 * Initiates an outbound call using Exotel
 * @param {string} to - The phone number to call
 * @param {string} purpose - The context/goal of the call
 * @param {string} userId - The user ID
 */
export async function makeExotelCall(to, purpose, userId) {
    const auth = Buffer.from(`${apiKey}:${apiToken}`).toString("base64");
    const url = `https://api.exotel.com/v1/Accounts/${accountSid}/Calls/connect.json`;

    const params = new URLSearchParams();
    params.append("From", virtualNumber);
    params.append("To", to);
    params.append("CallerId", virtualNumber);
    // Exotel uses "Url" for the webhook instructions similar to Twilio
    params.append("Url", `${backendUrl}/voice/exotel/webhook?purpose=${encodeURIComponent(purpose)}&userId=${userId}`);
    params.append("StatusCallback", `${backendUrl}/voice/exotel/status`);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: params
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.RestException?.Message || "Exotel API Error");
        }

        console.log(`📞 Exotel Call initiated: ${data.Call.Sid}`);
        return data.Call;
    } catch (error) {
        console.error("❌ Exotel error:", error.message);
        throw error;
    }
}
