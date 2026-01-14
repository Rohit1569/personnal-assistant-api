import express from "express";
import { orchestrator } from "../orchestrator.js";
import { sendOperationConfirmationEmail, shouldSendConfirmationEmail, extractRecipientEmail } from "../services/confirmationEmailService.js";

const router = express.Router();

// Middleware to extract token from Authorization header
function extractToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  console.log("🔍 Authorization header:", authHeader ? `${authHeader.substring(0, 30)}...` : "MISSING");
  
  if (authHeader && authHeader.startsWith("Bearer ")) {
    req.accessToken = authHeader.slice(7);
    console.log("✅ Token extracted, length:", req.accessToken.length);
  } else {
    console.log("⚠️  No Bearer token found in header");
  }
  
  next();
}

router.use(extractToken);

router.post("/", async (req, res) => {
  const { userId, text } = req.body;
  const accessToken = req.accessToken;

  console.log("📝 Voice command received:", { text, userId });
  console.log("🔑 Access token:", accessToken ? `${accessToken.substring(0, 20)}...` : "NOT PROVIDED");

  if (!userId || !text) {
    return res.status(400).json({
      success: false,
      message: "User ID and text are required",
    });
  }

  if (!accessToken) {
    return res.status(401).json({
      success: false,
      message: "Authorization token required",
    });
  }

  try {
    // Debug: log the token one more time right before calling orchestrator
    console.log("🎯 Before orchestrator call:");
    console.log("  - req.accessToken:", req.accessToken ? `${req.accessToken.substring(0, 20)}...` : "UNDEFINED");
    console.log("  - accessToken variable:", accessToken ? `${accessToken.substring(0, 20)}...` : "UNDEFINED");
    console.log("  - Are they the same?", req.accessToken === accessToken);
    
    // Pass accessToken to orchestrator
    const result = await orchestrator(text, userId, accessToken);

    // Check result and generate appropriate response
    if (result.status === "UNSUPPORTED_INTENT") {
      return res.json({
        success: false,
        message: "I didn't understand that command. Try asking me to send an email or schedule a meeting.",
      });
    }

    // For successful operations
    if (result.success || result.status === "SUCCESS") {
      let message = result.message || "Action completed successfully!";
      let operationType = null;
      let operationAction = null;

      // Enhance message based on action and prepare for confirmation email
      if (result.action === "email_sent") {
        message = `✅ Email sent to ${result.to}${result.subject ? ` with subject "${result.subject}"` : ""}`;
        operationType = "email";
        operationAction = "send";
      } else if (result.action === "email_drafted") {
        message = `✅ Email drafted (ready to send)`;
        operationType = "email";
        operationAction = "draft";
      } else if (result.action === "emails_found") {
        message = `Found ${result.count} emails`;
        operationType = "email";
        operationAction = "search";
      } else if (result.action === "emails_summarized") {
        message = `Summarized ${result.count} emails`;
        operationType = "email";
        operationAction = "summarize";
      } else if (result.action === "event_created") {
        message = `✅ Event "${result.summary}" scheduled`;
        operationType = "calendar";
        operationAction = "create";
      } else if (result.action === "event_modified") {
        message = `✅ Event updated`;
        operationType = "calendar";
        operationAction = "modify";
      } else if (result.action === "event_deleted") {
        message = `✅ Event deleted`;
        operationType = "calendar";
        operationAction = "delete";
      } else if (result.action === "events_listed") {
        message = `Found ${result.count} upcoming events`;
        operationType = "calendar";
        operationAction = "list";
      } else if (result.action === "availability_checked") {
        message = `Found ${result.availableSlots?.length || 0} available time slots`;
        operationType = "calendar";
        operationAction = "check";
      }

      // Send confirmation email if requested
      if (shouldSendConfirmationEmail(text) && operationType && operationAction) {
        const recipientEmail = extractRecipientEmail(text);
        if (recipientEmail) {
          console.log(`📧 Sending confirmation email to ${recipientEmail}`);
          const confirmationResult = await sendOperationConfirmationEmail(
            operationAction,
            operationType,
            result,
            recipientEmail,
            accessToken
          );
          
          if (confirmationResult && confirmationResult.status === "SUCCESS") {
            console.log(`✅ Confirmation email sent successfully`);
            message += ` (Confirmation email sent to ${recipientEmail})`;
          } else {
            console.log(`⚠️  Failed to send confirmation email`);
          }
        }
      }

      return res.json({
        success: true,
        message,
        action: result.action,
        data: result,
      });
    }

    // Handle errors
    if (result.status === "ERROR") {
      return res.json({
        success: false,
        message: result.message || "Could not process your request",
        data: result,
      });
    }

    return res.json({
      success: true,
      message: "Command processed",
      data: result,
    });
  } catch (error) {
    console.error("Voice command error:", error);
    return res.status(500).json({
      success: false,
      message: `Error: ${error.message || "Could not process your request"}`,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

export default router;
