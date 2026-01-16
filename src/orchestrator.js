import { askLLM } from "./tools/llm.js";
import { emailAgent } from "./agents/emailAgent.js";
import { calendarAgent } from "./agents/calendarAgent.js";
import { callAgent } from "./agents/callAgent.js";

/**
 * Helper: Extracts and normalizes an email address from a sentence
 * Supports voice commands like "Rohit Verma 1569 at gmail.com"
 */
function extractEmailAndBody(input) {
  if (!input) return { email: "", body: "" };

  // Replace ' at ' with '@' to support voice commands
  const normalizedInput = input.replace(/\s+at\s+/gi, "@");

  // Regex to find email
  const emailRegex = /([a-zA-Z0-9._%+\-\s]+)@([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/;
  const match = normalizedInput.match(emailRegex);

  if (!match) return { email: "", body: input };

  // Normalize local part and domain
  const local = match[1].replace(/\s+/g, ""); // remove spaces
  const domain = match[2].toLowerCase();      // lowercase domain
  const email = `${local}@${domain}`;

  // Remove email part from sentence to get message body
  const body = normalizedInput.replace(match[0], "").trim();

  return { email, body };
}

/**
 * Safe JSON parser for LLM responses
 */
function safeParseJSON(input) {
  try {
    if (typeof input === "object") return input;
    const text = typeof input === "string" ? input.trim() : JSON.stringify(input);
    return JSON.parse(text);
  } catch (e) {
    console.error("❌ JSON parse error:", e.message, "Input:", input);
    return null;
  }
}

/**
 * Main orchestrator - routes commands to appropriate agents
 */
export async function orchestrator(command, userId = "user123", accessToken = null) {
  const prompt = `
You are an AI intent parser for Rohit, a productivity assistant. Extract details from the user's command.
The assistant supports Email, Calendar, and Voice Calling.

User command:
"${command}"

Return ONLY valid JSON:
{
  "intent": "email_send|email_summarize|calendar_create|calendar_delete|voice_call",
  "action": "send|summarize|create|delete|call",
  "service": "email|calendar|voice",
  "details": {
    "to": "",
    "subject": "",
    "body": "",
    "title": "",
    "start": "",
    "phoneNumber": "",
    "purpose": "",
    "recipientName": ""
  }
}
`;

  try {
    // Call LLM with full prompt override
    const llmResponse = await askLLM(prompt, true);
    const parsed = safeParseJSON(llmResponse);
    if (!parsed) {
      return { status: "ERROR", message: "Failed to parse LLM response" };
    }

    console.log("🧠 Parsed intent:", {
      intent: parsed.intent,
      action: parsed.action,
      service: parsed.service,
      details: parsed.details
    });

    // --- Email service ---
    if (parsed.service === "email") {
      const details = { ...parsed.details };

      // If 'to' or 'body' contains full sentence, extract proper email + body
      if (details.to || details.body) {
        const { email, body } = extractEmailAndBody(details.to || details.body);
        if (email) details.to = email;
        if (body && !details.body) details.body = body;
      }

      return await emailAgent(parsed.action, details, userId, accessToken);
    }

    // --- Calendar service ---
    if (parsed.service === "calendar") {
      return await calendarAgent(parsed.action, parsed.details, userId, accessToken);
    }

    // --- Voice service (Calling) ---
    if (parsed.service === "voice" || parsed.intent === "voice_call") {
      return await callAgent(parsed.action, parsed.details, userId, accessToken);
    }

    return {
      status: "ERROR",
      message: "Could not determine service type. I can help with emails, calendar, and making phone calls."
    };
  } catch (error) {
    console.error("❌ Orchestrator error:", error.message);
    return {
      status: "ERROR",
      message: `Failed to process command: ${error.message}`
    };
  }
}
