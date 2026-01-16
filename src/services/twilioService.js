import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
const backendUrl = process.env.BACKEND_URL;

let client;
if (accountSid && authToken) {
    client = twilio(accountSid, authToken);
}

/**
 * Initiates an outbound call
 * @param {string} to - The phone number to call
 * @param {string} purpose - The context/goal of the call
 * @param {string} userId - The user ID
 */
export async function makeCall(to, purpose, userId) {
    if (!client) {
        throw new Error("Twilio client not initialized. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
    }

    try {
        const call = await client.calls.create({
            url: `${backendUrl}/voice/call/webhook?purpose=${encodeURIComponent(purpose)}&userId=${userId}`,
            to: to,
            from: twilioNumber,
        });

        console.log(`📞 Call initiated: ${call.sid}`);
        return call;
    } catch (error) {
        console.error("❌ Twilio error:", error);
        throw error;
    }
}

/**
 * Generates TwiML for the ongoing conversation
 * @param {string} text - The AI response text
 * @param {Object} options - Additional TwiML options
 */
export function generateTwiml(text, options = {}) {
    const response = new twilio.twiml.VoiceResponse();

    if (text) {
        response.say({
            voice: 'Polly.Matthew', // More natural voice
            language: 'en-US'
        }, text);
    }

    if (options.hangup) {
        response.hangup();
    } else {
        // Gather user speech
        response.gather({
            input: 'speech',
            action: options.action || '/voice/call/respond',
            speechTimeout: 'auto',
            hints: options.hints || 'appointment, schedule, doctor, yes, no',
        });
    }

    return response.toString();
}
