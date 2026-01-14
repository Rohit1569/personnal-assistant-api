/**
 * Email Body Generator Service
 * Auto-generates formatted email bodies for calendar operations
 */

export function generateCalendarEventEmail(operation, eventDetails) {
  const { title, start, end, description, participants, location } = eventDetails;

  let body = "";
  const timestamp = new Date().toLocaleString();

  switch (operation) {
    case "create":
      body = `
📅 Event Created

Event: ${title}
Date & Time: ${formatDateTime(start)} to ${formatDateTime(end) || ""}
Location: ${location || "Not specified"}
Description: ${description || "No description"}
Participants: ${formatParticipants(participants) || "You"}

---
Created: ${timestamp}
This is an automated notification from your Voice Assistant.
      `.trim();
      break;

    case "modify":
      body = `
📝 Event Updated

Event: ${title}
New Date & Time: ${formatDateTime(start)} to ${formatDateTime(end) || ""}
Location: ${location || "Not specified"}
Description: ${description || "No description"}

---
Updated: ${timestamp}
This is an automated notification from your Voice Assistant.
      `.trim();
      break;

    case "delete":
      body = `
🗑️ Event Deleted

Event: ${title}
Was scheduled: ${formatDateTime(start)} to ${formatDateTime(end) || ""}
Location: ${location || "Not specified"}

---
Deleted: ${timestamp}
This is an automated notification from your Voice Assistant.
      `.trim();
      break;

    case "list":
      body = formatEventsList(eventDetails);
      break;

    case "availability":
      body = formatAvailabilitySlots(eventDetails);
      break;

    default:
      body = `
Calendar Operation Completed

${JSON.stringify(eventDetails, null, 2)}

---
${timestamp}
      `.trim();
  }

  return body;
}

export function generateEmailOperationEmail(operation, emailDetails) {
  const { to, subject, body } = emailDetails;
  const timestamp = new Date().toLocaleString();

  let resultBody = "";

  switch (operation) {
    case "send":
      resultBody = `
✉️ Email Sent Successfully

To: ${to}
Subject: ${subject}

Message Preview:
${body ? body.substring(0, 200) + (body.length > 200 ? "..." : "") : "[No content]"}

---
Sent: ${timestamp}
This is an automated notification from your Voice Assistant.
      `.trim();
      break;

    case "draft":
      resultBody = `
📝 Email Draft Created

To: ${to}
Subject: ${subject}

Message Preview:
${body ? body.substring(0, 200) + (body.length > 200 ? "..." : "") : "[No content]"}

---
Draft saved: ${timestamp}
This email is saved as a draft. You can edit and send it later.
      `.trim();
      break;

    case "search":
      resultBody = `
🔍 Email Search Results

Query: ${emailDetails.query}
Found: ${emailDetails.count} email(s)

---
Search completed: ${timestamp}
      `.trim();
      break;

    default:
      resultBody = `
📧 Email Operation Completed

${JSON.stringify(emailDetails, null, 2)}

---
${timestamp}
      `.trim();
  }

  return resultBody;
}

/**
 * Helper: Format date and time
 */
function formatDateTime(dateStr) {
  if (!dateStr) return "";
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    return date.toLocaleString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC"
    });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Helper: Format participants list
 */
function formatParticipants(participants) {
  if (!participants || participants.length === 0) return "";
  if (Array.isArray(participants)) {
    return participants.join(", ");
  }
  return participants;
}

/**
 * Helper: Format events list
 */
function formatEventsList(eventDetails) {
  const { events = [], count = 0, days = 7 } = eventDetails;
  const timestamp = new Date().toLocaleString();

  let body = `📅 Upcoming Events (Next ${days} days)\n\n`;
  body += `Found: ${count} event(s)\n\n`;

  if (events.length > 0) {
    events.forEach((event, index) => {
      body += `${index + 1}. ${event.summary}\n`;
      body += `   📍 ${formatDateTime(event.start)}\n`;
      if (event.location) {
        body += `   📌 ${event.location}\n`;
      }
      if (event.attendees) {
        body += `   👥 ${event.attendees} attendee(s)\n`;
      }
      body += "\n";
    });
  } else {
    body += "No upcoming events scheduled.\n";
  }

  body += `---\n${timestamp}\nThis is an automated notification from your Voice Assistant.`;
  return body;
}

/**
 * Helper: Format availability slots
 */
function formatAvailabilitySlots(availability) {
  const { availableSlots = [], busyCount = 0 } = availability;
  const timestamp = new Date().toLocaleString();

  let body = `⏰ Available Time Slots\n\n`;
  body += `Found: ${availableSlots.length} available slot(s)\n`;
  body += `Busy times: ${busyCount}\n\n`;

  if (availableSlots.length > 0) {
    availableSlots.forEach((slot, index) => {
      body += `${index + 1}. ${formatDateTime(slot.start)}\n`;
      body += `   Duration: 1 hour\n\n`;
    });
  } else {
    body += "No available slots found for the requested period.\n";
  }

  body += `---\n${timestamp}\nThis is an automated notification from your Voice Assistant.`;
  return body;
}

export default {
  generateCalendarEventEmail,
  generateEmailOperationEmail,
};
