// 

import dotenv from "dotenv";
dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  throw new Error("❌ OPENAI_API_KEY not found in environment");
}

/**
 * Ask LLM to generate professional email or calendar action
 * @param {string} userInstruction
 * @returns {Promise<Object>} JSON containing subject/body or event details
 */
export async function askLLM(userInstruction) {
  try {
    const prompt = `
You are a highly efficient Personal Productivity Assistant with full access to the user's Google Calendar and Gmail.
Your primary goal is to enhance the user's productivity by managing communications and scheduling.

CORE OPERATING PRINCIPLES:
1. TOOL USAGE: Only use Email or Calendar tools when the user gives an explicit instruction.
2. CONFIRMATION: Always confirm details (date, time, recipient, subject, key points) before sending emails or creating calendar events.
3. TONE & STYLE: Match the user's communication style (professional, friendly, concise).
4. CONTEXT: Use provided context to draft comprehensive responses.
5. EMAIL CONTENT: If drafting or sending email, generate a professional subject and polished body.
6. CALENDAR ACTIONS: If scheduling events, provide structured JSON output.

Format your output strictly in JSON:
{
  "subject": "...",
  "body": "..."
}

USER INSTRUCTION: "${userInstruction}"
`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:4000",
        "X-Title": "Voice Assistant",
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 400,
      }),
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error("LLM Error:", error);
    throw error;
  }
}
