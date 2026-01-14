import { google } from "googleapis";
import { generateCalendarEventEmail, generateEmailOperationEmail } from "./emailBodyGenerator.js";

/**
 * Service to send confirmation emails after operations
 */

export async function sendOperationConfirmationEmail(
  operation,
  operationType, // "calendar" or "email"
  operationDetails,
  recipientEmail,
  accessToken
) {
  if (!accessToken || !recipientEmail) {
    console.log("⚠️  Cannot send confirmation: missing accessToken or recipientEmail");
    return null;
  }

  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    auth.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: "v1", auth });

    // Generate body based on operation type
    let subject = "";
    let body = "";

    if (operationType === "calendar") {
      subject = `📅 Calendar Operation: ${operation.charAt(0).toUpperCase() + operation.slice(1)}`;
      body = generateCalendarEventEmail(operation, operationDetails);
    } else if (operationType === "email") {
      subject = `📧 Email Operation: ${operation.charAt(0).toUpperCase() + operation.slice(1)}`;
      body = generateEmailOperationEmail(operation, operationDetails);
    } else {
      subject = `✅ Operation Completed: ${operation}`;
      body = JSON.stringify(operationDetails, null, 2);
    }

    // Create the email message
    const message = `To: ${recipientEmail}\r\nSubject: ${subject}\r\n\r\n${body}`;
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });

    console.log(`✉️  Confirmation email sent to ${recipientEmail}`);
    return {
      status: "SUCCESS",
      messageId: response.data.id,
      recipient: recipientEmail,
    };
  } catch (error) {
    console.error("❌ Error sending confirmation email:", error.message);
    return {
      status: "ERROR",
      message: error.message,
    };
  }
}

/**
 * Extract recipient email from text or use current user's email
 */
export function extractRecipientEmail(text, defaultEmail) {
  // Try to extract email from text
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) {
    return emailMatch[0];
  }
  return defaultEmail;
}

/**
 * Determine if confirmation email should be sent based on text
 */
export function shouldSendConfirmationEmail(text) {
  const confirmationKeywords = [
    "send mail",
    "send email",
    "mail me",
    "email me",
    "notify me",
    "confirm",
    "tell me",
    "let me know",
  ];

  return confirmationKeywords.some((keyword) =>
    text.toLowerCase().includes(keyword)
  );
}

/**
 * Auto-generate email body based on calendar operation
 */
export function generateAutoEmailBody(operationType, operationDetails) {
  if (operationType === "calendar") {
    return generateCalendarEventEmail("summary", operationDetails);
  } else if (operationType === "email") {
    return generateEmailOperationEmail("summary", operationDetails);
  }
  return "";
}

export default {
  sendOperationConfirmationEmail,
  extractRecipientEmail,
  shouldSendConfirmationEmail,
  generateAutoEmailBody,
};
