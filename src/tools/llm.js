// 

import dotenv from "dotenv";
dotenv.config();

/**
 * Ask LLM to process instructions or generate responses
 * @param {string} userInstruction - The prompt or instruction for the LLM
 * @param {boolean} systemPromptOverride - If true, treats userInstruction as the full prompt
 * @returns {Promise<Object|string>} Parsed JSON or raw string depending on instruction
 */
export async function askLLM(userInstruction, systemPromptOverride = false) {
  try {
    const prompt = systemPromptOverride
      ? userInstruction
      : `
You are a highly efficient Personal AI Assistant (Rohit).
Your primary goal is to enhance the user's productivity by managing communications, scheduling, and making phone calls.

CORE OPERATING PRINCIPLES:
1. TOOL USAGE: Use Email, Calendar, or Calling tools based on user instruction.
2. CONFIRMATION: Confirm critical details before final execution.
3. TONE: Professional, efficient, and helpful.

USER INSTRUCTION: "${userInstruction}"
`;

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("❌ No API Key found in environment");
    }

    console.log(`🤖 [LLM] Calling OpenRouter...`);
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:4000",
        "X-Title": "Rohit Assistant",
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 600,
      }),
    });

    console.log(`🤖 [LLM] Response status: ${response.status}`);

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Try to parse as JSON if it looks like JSON, otherwise return as string
    try {
      if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        return JSON.parse(content);
      }
      return content;
    } catch (e) {
      return content;
    }
  } catch (error) {
    console.error("LLM Error:", error);
    throw error;
  }
}
