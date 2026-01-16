import express from "express";
import { generateTwiml } from "../services/twilioService.js";
import { askLLM } from "../tools/llm.js";
import { emailAgent } from "../agents/emailAgent.js";
import GoogleAccount from "../db/models/GoogleAccount.js";

const router = express.Router();

// In-memory storage for call sessions (for dev/testing)
const callSessions = new Map();

/**
 * Endpoint for initial call greeting
 */
router.post("/call/webhook", (req, res) => {
    const { purpose, userId } = req.query;
    const callSid = req.body.CallSid;

    console.log(`📡 Initial Webhook for Call ${callSid}`);

    // Initialize session
    callSessions.set(callSid, {
        userId,
        purpose,
        history: [],
        startTime: new Date()
    });

    const greeting = `Hello, I am Rohit, a personal AI assistant calling on behalf of my user regarding ${purpose}. How can I help you?`;

    const twiml = generateTwiml(greeting, {
        action: "/voice/call/respond"
    });

    res.type("text/xml").send(twiml);
});

/**
 * Endpoint for responding to human speech during the call
 */
router.post("/call/respond", async (req, res) => {
    const callSid = req.body.CallSid;
    const speechResult = req.body.SpeechResult;
    const session = callSessions.get(callSid);

    if (!session) {
        console.error(`❌ No session found for CallSid: ${callSid}`);
        const twiml = generateTwiml("I'm sorry, I encountered a system error. Goodbye.", { hangup: true });
        return res.type("text/xml").send(twiml);
    }

    console.log(`🗣️ Human said: ${speechResult}`);
    session.history.push({ role: "human", text: speechResult });

    try {
        // 1. Prepare prompt for LLM
        const prompt = `
You are Rohit, a personal AI assistant on a phone call.
User's purpose for this call: ${session.purpose}

Conversation history:
${session.history.map(h => `${h.role}: ${h.text}`).join('\n')}

Role:
- Be polite, professional, and concise.
- If you have achieved the goal (e.g. booked the appointment), end the call gracefully.
- If you are stuck, ask for clarification.
- If you want to end the call, include "[END_CALL]" at the end of your response.

Human's last response: "${speechResult}"
AI Response:`;

        // 2. Get AI response
        const aiResponse = await askLLM(prompt, true);

        // 3. Update history
        session.history.push({ role: "ai", text: aiResponse.replace("[END_CALL]", "") });

        // 4. Generate TwiML
        const shouldEnd = aiResponse.includes("[END_CALL]");
        const twiml = generateTwiml(aiResponse.replace("[END_CALL]", ""), {
            hangup: shouldEnd,
            action: "/voice/call/respond"
        });

        res.type("text/xml").send(twiml);
    } catch (error) {
        console.error("❌ Live Call LLM Error:", error);
        const twiml = generateTwiml("I'm having trouble connecting to my central brain. Let me call you back later. Goodbye.", { hangup: true });
        res.type("text/xml").send(twiml);
    }
});

/**
 * Handle call status changes (to summarize when finished)
 */
router.post("/call/status", async (req, res) => {
    const { CallSid, CallStatus } = req.body;
    const session = callSessions.get(CallSid);

    if (session && (CallStatus === "completed" || CallStatus === "busy" || CallStatus === "no-answer")) {
        console.log(`🏁 Call ${CallSid} ended with status: ${CallStatus}`);

        if (session.history.length > 0) {
            await summarizeAndEmail(CallSid, session);
        }

        // Cleanup
        callSessions.delete(CallSid);
    }

    res.sendStatus(200);
});

/**
 * Summarize the conversation and send an email
 */
async function summarizeAndEmail(callSid, session) {
    try {
        const summaryPrompt = `
Summarize the following phone call conversation for the user.
Purpose: ${session.purpose}

History:
${session.history.map(h => `${h.role}: ${h.text}`).join('\n')}

Format as 5-8 bullet points. Include success/failure status.
`;

        const summary = await askLLM(summaryPrompt, true);

        console.log("📝 Call Summary Generated:", summary);

        // Fetch user's Google account to get access token
        const account = await GoogleAccount.findOne({ where: { userId: session.userId } });

        const details = {
            to: account ? account.email : "me", // "me" works if we have token
            subject: `AI Call Summary – ${session.purpose}`,
            body: `
Here is the summary of the AI call made on your behalf:

- Purpose: ${session.purpose}
- Date: ${session.startTime.toLocaleString()}
- Status: Completed

Summary:
${summary}

Full Transcript:
${session.history.map(h => `${h.role.toUpperCase()}: ${h.text}`).join('\n')}
      `
        };

        if (account && account.accessToken) {
            console.log("📧 Sending summary email via Gmail API...");
            await emailAgent("send", details, session.userId, account.accessToken);
        } else {
            console.warn("⚠️ No Google account found for user, cannot send email summary.");
        }

    } catch (error) {
        console.error("❌ Error summarizing call:", error);
    }
}

export default router;
