import { google } from "googleapis";
import { askLLM } from "../tools/llm.js"; // make sure path is correct

/**
 * Helper: Extracts and normalizes an email address from a string
 * Example: "send email to rohit verma 1569@gmail.com" -> "rohitverma1569@gmail.com"
 */
function extractEmail(input) {
  if (!input) return "";

  // Match anything that looks like an email
  const emailRegex = /([a-zA-Z0-9._%+\-\s]+)@([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/;
  const match = input.match(emailRegex);

  if (!match) return ""; // no email found

  let local = match[1].replace(/\s+/g, ""); // remove all spaces in local part
  let domain = match[2].toLowerCase();      // normalize domain to lowercase

  return `${local}@${domain}`;
}

/**
 * Email Agent - Handles all email operations
 * Actions: send, draft, reply, search, label, summarize
 */
export async function emailAgent(action = "send", details = {}, userId = "user123", accessToken = null) {
  console.log(`📧 Email agent - Action: ${action}`, { to: details.to, subject: details.subject });

  if (!accessToken) {
    return { status: "ERROR", message: "No access token provided" };
  }

  try {
    // Create OAuth2 client
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    auth.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: "v1", auth });

    // Route to appropriate action
    switch (action) {
      case "send":
        return await sendEmail(gmail, details);
      case "draft":
        return await draftEmail(gmail, details);
      case "reply":
        return await replyEmail(gmail, details);
      case "search":
        return await searchEmails(gmail, details);
      case "label":
        return await labelEmail(gmail, details);
      case "summarize":
        return await summarizeEmails(gmail, details);
      default:
        return { status: "ERROR", message: `Unknown email action: ${action}` };
    }
  } catch (error) {
    console.error(`❌ Email agent error (${action}):`, error.message);
    return {
      status: "ERROR",
      action,
      message: `Failed to ${action} email: ${error.message}`,
    };
  }
}

/**
 * Send an email
 */
async function sendEmail(gmail, { to, subject, body, promptForBody }) {
  if (!to || !subject) {
    return { status: "ERROR", message: "Email recipient and subject are required" };
  }

  const normalizedTo = extractEmail(to);

  // Generate body using LLM if body is empty and prompt is provided
  let finalBody = body;
  if ((!body || body.trim() === "") && promptForBody) {
    try {
      console.log("🧠 Generating email body using LLM...");
      finalBody = await askLLM(`Write a professional, concise email based on this instruction: "${promptForBody}"`);
      finalBody = finalBody.trim();
      console.log("✍️ Generated body:", finalBody);
    } catch (err) {
      console.error("❌ LLM body generation failed:", err);
      finalBody = "";
    }
  }

  const message = `To: ${normalizedTo}\r\nSubject: ${subject}\r\n\r\n${finalBody || ""}`;
  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage },
  });

  return {
    status: "SUCCESS",
    action: "email_sent",
    to: normalizedTo,
    subject,
    messageId: response.data.id,
    message: `✅ Email sent to ${normalizedTo}`,
    body: finalBody,
  };
}

/**
 * Draft an email (save without sending)
 */
async function draftEmail(gmail, { to, subject, body, promptForBody }) {
  if (!to || !subject) {
    return { status: "ERROR", message: "Email recipient and subject are required" };
  }

  const normalizedTo = extractEmail(to);

  // Generate body using LLM if body is empty and prompt is provided
  let finalBody = body;
  if ((!body || body.trim() === "") && promptForBody) {
    try {
      console.log("🧠 Generating draft email body using LLM...");
      finalBody = await askLLM(`Write a professional, concise email based on this instruction: "${promptForBody}"`);
      finalBody = finalBody.trim();
      console.log("✍️ Generated draft body:", finalBody);
    } catch (err) {
      console.error("❌ LLM draft body generation failed:", err);
      finalBody = "";
    }
  }

  const message = `To: ${normalizedTo}\r\nSubject: ${subject}\r\n\r\n${finalBody || ""}`;
  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: { raw: encodedMessage },
    },
  });

  return {
    status: "SUCCESS",
    action: "email_drafted",
    to: normalizedTo,
    subject,
    draftId: response.data.id,
    message: `✅ Email draft created (not sent)`,
    body: finalBody,
  };
}

/**
 * Reply to an email
 */
async function replyEmail(gmail, { messageId, body, subject }) {
  if (!messageId || !body) {
    return { status: "ERROR", message: "Message ID and reply body are required" };
  }

  try {
    const original = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "metadata",
      metadataHeaders: ["From", "Subject"],
    });

    const headers = original.data.payload.headers;
    const from = extractEmail(headers.find(h => h.name === "From")?.value || "");
    const originalSubject = headers.find(h => h.name === "Subject")?.value || "";
    const replySubject = originalSubject.startsWith("Re:") ? originalSubject : `Re: ${originalSubject}`;

    const message = `To: ${from}\r\nSubject: ${replySubject}\r\nIn-Reply-To: ${messageId}\r\n\r\n${body}`;
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
        threadId: original.data.threadId,
      },
    });

    return {
      status: "SUCCESS",
      action: "email_replied",
      messageId: response.data.id,
      threadId: original.data.threadId,
      message: `✅ Reply sent`,
    };
  } catch (error) {
    return { status: "ERROR", message: `Failed to reply: ${error.message}` };
  }
}

/**
 * Search emails
 */
async function searchEmails(gmail, { query, maxResults = 10 }) {
  if (!query) {
    return { status: "ERROR", message: "Search query is required" };
  }

  try {
    const response = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: Math.min(maxResults, 50),
    });

    const messages = response.data.messages || [];

    const details = await Promise.all(
      messages.map(m =>
        gmail.users.messages.get({
          userId: "me",
          id: m.id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        })
      )
    );

    const results = details.map(msg => ({
      id: msg.data.id,
      threadId: msg.data.threadId,
      from: msg.data.payload.headers.find(h => h.name === "From")?.value,
      subject: msg.data.payload.headers.find(h => h.name === "Subject")?.value,
      date: msg.data.payload.headers.find(h => h.name === "Date")?.value,
    }));

    return {
      status: "SUCCESS",
      action: "emails_found",
      query,
      count: results.length,
      results,
      message: `Found ${results.length} emails matching "${query}"`,
    };
  } catch (error) {
    return { status: "ERROR", message: `Failed to search: ${error.message}` };
  }
}

/**
 * Label an email
 */
async function labelEmail(gmail, { messageId, labels = [] }) {
  if (!messageId || !labels.length) {
    return { status: "ERROR", message: "Message ID and label(s) are required" };
  }

  try {
    const labelList = await gmail.users.labels.list({ userId: "me" });
    const existingLabels = labelList.data.labels || [];

    const labelIds = [];
    for (const labelName of labels) {
      let label = existingLabels.find(l => l.name === labelName);
      if (!label) {
        const created = await gmail.users.labels.create({
          userId: "me",
          requestBody: {
            name: labelName,
            labelListVisibility: "labelShow",
            messageListVisibility: "show",
          },
        });
        label = created.data;
      }
      labelIds.push(label.id);
    }

    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: { addLabelIds: labelIds },
    });

    return {
      status: "SUCCESS",
      action: "email_labeled",
      messageId,
      labels,
      message: `✅ Labels applied: ${labels.join(", ")}`,
    };
  } catch (error) {
    return { status: "ERROR", message: `Failed to label: ${error.message}` };
  }
}

/**
 * Summarize emails from a search query
 */
async function summarizeEmails(gmail, { query = "is:unread", maxResults = 5 }) {
  try {
    const response = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: Math.min(maxResults, 10),
    });

    const messages = response.data.messages || [];
    if (!messages.length) {
      return {
        status: "SUCCESS",
        action: "emails_summarized",
        summary: "No emails found matching your query",
      };
    }

    const details = await Promise.all(
      messages.map(m =>
        gmail.users.messages.get({
          userId: "me",
          id: m.id,
          format: "full",
        })
      )
    );

    const emailList = details.map(msg => {
      const headers = msg.data.payload.headers;
      const from = headers.find(h => h.name === "From")?.value || "";
      const subject = headers.find(h => h.name === "Subject")?.value || "";
      const body = msg.data.snippet || "";
      return { from, subject, body };
    });

    const summary = emailList
      .map((e, i) => `${i + 1}. From: ${e.from}\n   Subject: ${e.subject}\n   Preview: ${e.body.substring(0, 100)}...`)
      .join("\n\n");

    return {
      status: "SUCCESS",
      action: "emails_summarized",
      count: emailList.length,
      summary,
      message: `✅ Summarized ${emailList.length} emails`,
    };
  } catch (error) {
    return { status: "ERROR", message: `Failed to summarize: ${error.message}` };
  }
}
