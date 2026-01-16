import { makeCall } from "../services/twilioService.js";

/**
 * Call Agent - Handles requests to make phone calls
 * @param {string} action - The action to perform (currently only 'call')
 * @param {Object} details - Details about the call (phoneNumber, purpose, recipientName)
 * @param {string} userId - User ID
 * @param {string} accessToken - Google Access Token (for emails later)
 */
export async function callAgent(action, details, userId, accessToken) {
    if (action !== "call") {
        return {
            status: "ERROR",
            message: `Unsupported call action: ${action}`
        };
    }

    const { phoneNumber, purpose, recipientName } = details;

    if (!phoneNumber) {
        return {
            status: "ERROR",
            message: "Please provide a phone number to call."
        };
    }

    try {
        console.log(`🤖 CallAgent: Initiating call to ${phoneNumber} for ${purpose || 'general inquiry'}`);

        const callResult = await makeCall(phoneNumber, purpose || "Identify as an AI assistant and help with the user's request", userId);

        return {
            status: "SUCCESS",
            success: true,
            action: "call_initiated",
            message: `📞 Okay, I'm calling ${recipientName || phoneNumber} right now regarding ${purpose || 'your request'}.`,
            callSid: callResult.sid,
            phoneNumber,
            purpose
        };
    } catch (error) {
        console.error("❌ CallAgent error:", error.message);

        // Check for specific Twilio errors (e.g., trial account restrictions)
        if (error.message.includes("not verified")) {
            return {
                status: "ERROR",
                message: "I can only call verified numbers in this development environment. Please verify your number in Twilio first."
            };
        }

        return {
            status: "ERROR",
            message: `Failed to initiate call: ${error.message}`
        };
    }
}
