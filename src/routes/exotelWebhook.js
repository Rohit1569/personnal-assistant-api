import express from "express";
import { askLLM } from "../tools/llm.js";
import { emailAgent } from "../agents/emailAgent.js";
import GoogleAccount from "../db/models/GoogleAccount.js";

const router = express.Router();

// Session storage
const callSessions = new Map();

/**
 * Helper to generate ExoML (Exotel's XML)
 */
function generateExoml(text, options = {}) {
    let exoml = `<?xml version="1.0" encoding="UTF-8"?><Response>`;

    if (text) {
        exoml += `<Say>${text}</Say>`;
    }

    if (options.hangup) {
        exoml += `<Hangup/>`;
    } else {
        // Exotel Gather for speech (Note: requires Exotel account to have STT enabled)
        exoml += `<Gather input="speech" action="${options.action || '/voice/exotel/respond'}" timeout="5">
            <Say>...</Say>
        </Gather>`;
    }

    exoml += `</Response>`;
    return exoml;
}

/**
 * Initial Webhook (from makeExotelCall)
 */
router.post("/exotel/webhook", (req, res) => {
    const { purpose, userId } = req.query;
    const callSid = req.body.CallSid;

    console.log(`📡 Exotel Webhook Triggered for ${callSid}`);

    callSessions.set(callSid, {
        userId,
        purpose,
        history: [],
        startTime: new Date()
    });

    const greeting = `Hello, I am Rohit, a personal AI assistant calling for ${purpose}. How can I help you?`;
    res.type("text/xml").send(generateExoml(greeting));
});

/**
 * Response Webhook (after human speaks)
 */
router.post("/exotel/respond", async (req, res) => {
    const callSid = req.body.CallSid;
    const speechResult = req.body.SpeechResult || req.body.Digits; // Exotel might send Digits if speech fails
    const session = callSessions.get(callSid);

    if (!session) {
        return res.type("text/xml").send(generateExoml("System error. Goodbye.", { hangup: true }));
    }

    console.log(`🗣️ Human (Exotel) said: ${speechResult}`);
    session.history.push({ role: "human", text: speechResult });

    const prompt = `
You are Rohit, a personal AI assistant on a phone call.
User's purpose: ${session.purpose}
History: ${session.history.map(h => `${h.role}: ${h.text}`).join('\n')}
Role: Be professional. Include "[END_CALL]" to hang up.
AI Response:`;

    const aiResponse = await askLLM(prompt, true);
    session.history.push({ role: "ai", text: aiResponse.replace("[END_CALL]", "") });

    const shouldEnd = aiResponse.includes("[END_CALL]");
    res.type("text/xml").send(generateExoml(aiResponse.replace("[END_CALL]", ""), {
        hangup: shouldEnd
    }));
});

export default router;
