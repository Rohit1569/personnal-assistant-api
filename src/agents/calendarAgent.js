import { google } from "googleapis";

/**
 * Calendar Agent - Handles all calendar operations
 * Actions: create, modify, delete, list, availability
 */
export async function calendarAgent(action = "create", details = {}, userId = "user123", accessToken = null) {
  console.log(`📅 Calendar agent - Action: ${action}`, { title: details.title });

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

    const calendar = google.calendar({ version: "v3", auth });

    // Route to appropriate action
    switch (action) {
      case "create":
        return await createEvent(calendar, details);
      case "modify":
        return await modifyEvent(calendar, details);
      case "delete":
        return await deleteEvent(calendar, details);
      case "list":
        return await listEvents(calendar, details);
      case "check":
        return await checkAvailability(calendar, details);
      default:
        return { status: "ERROR", message: `Unknown calendar action: ${action}` };
    }
  } catch (error) {
    console.error(`❌ Calendar agent error (${action}):`, error.message);
    return {
      status: "ERROR",
      action,
      message: `Failed to ${action} event: ${error.message}`,
    };
  }
}

/**
 * Create a calendar event
 */
async function createEvent(calendar, { title, start, end, description = "", participants = [], location = "" }) {
  // Build title if not provided or if it's just "Meeting"
  let eventTitle = title;
  if (!eventTitle || eventTitle === "Meeting") {
    if (description) {
      eventTitle = `Meeting - ${description}`;
    } else if (participants && participants.length > 0) {
      const names = participants.map(p => p.split("@")[0]).join(", ");
      eventTitle = `Meeting with ${names}`;
    } else {
      eventTitle = "Meeting";
    }
  }

  console.log(`📝 Creating event: "${eventTitle}" at ${start}`);

  // Use the ISO string directly if provided by the LLM
  let startDateTime, endDateTime;
  try {
    startDateTime = new Date(start);
    if (isNaN(startDateTime.getTime())) throw new Error("Invalid start date");

    if (end) {
      endDateTime = new Date(end);
    } else {
      endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // Default 1 hour
    }
  } catch (e) {
    console.log("⚠️ Fallback to manual parsing for:", start);
    const parsed = parseDateTime(start, end);
    startDateTime = parsed.startDateTime;
    endDateTime = parsed.endDateTime;
  }

  const event = {
    summary: eventTitle,
    description: description || "Created via Voice Assistant",
    location,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
    },
  };

  // Add participants if provided (only valid email addresses)
  if (participants && participants.length > 0) {
    const validEmails = participants.filter(p => p && p.includes('@'));
    if (validEmails.length > 0) {
      event.attendees = validEmails.map(p => ({
        email: p,
        responseStatus: "needsAction",
      }));
    }
    // Note: Names without emails are already in the title, so don't fail
  }

  try {
    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
      sendNotifications: true,
    });

    return {
      status: "SUCCESS",
      action: "event_created",
      summary: title,
      startTime: startDateTime.toISOString(),
      eventId: response.data.id,
      eventLink: response.data.htmlLink,
      message: `✅ Event "${title}" scheduled for ${startDateTime.toLocaleString()}`,
    };
  } catch (error) {
    return { status: "ERROR", message: `Failed to create event: ${error.message}` };
  }
}

/**
 * Modify (update) an existing calendar event
 */
async function modifyEvent(calendar, { eventId, title, start, end, description, location }) {
  if (!eventId) {
    return { status: "ERROR", message: "Event ID is required" };
  }

  try {
    // Get existing event
    const event = await calendar.events.get({
      calendarId: "primary",
      eventId,
    });

    // Update fields
    if (title) event.data.summary = title;
    if (description) event.data.description = description;
    if (location) event.data.location = location;

    // Update times if provided
    if (start || end) {
      const { startDateTime, endDateTime } = parseDateTime(start, end);
      event.data.start = {
        dateTime: startDateTime.toISOString(),
        timeZone: "UTC",
      };
      event.data.end = {
        dateTime: endDateTime.toISOString(),
        timeZone: "UTC",
      };
    }

    const response = await calendar.events.update({
      calendarId: "primary",
      eventId,
      requestBody: event.data,
      sendNotifications: true,
    });

    return {
      status: "SUCCESS",
      action: "event_modified",
      eventId: response.data.id,
      summary: response.data.summary,
      message: `✅ Event updated successfully`,
    };
  } catch (error) {
    return { status: "ERROR", message: `Failed to modify event: ${error.message}` };
  }
}

/**
 * Delete a calendar event
 */
async function deleteEvent(calendar, { eventId, title }) {
  try {
    let resolvedEventId = eventId;

    // If no eventId but title is provided, search for the event
    if (!resolvedEventId && title) {
      const searchResult = await findEventByTitle(calendar, title);
      if (searchResult) {
        resolvedEventId = searchResult.id;
        console.log(`🔍 Found event by title: ${title} (ID: ${resolvedEventId})`);
      } else {
        return {
          status: "ERROR",
          message: `Could not find event "${title}". Please check the event name or provide an event ID.`
        };
      }
    }

    if (!resolvedEventId) {
      return { status: "ERROR", message: "Event ID or title is required to delete an event" };
    }

    await calendar.events.delete({
      calendarId: "primary",
      eventId: resolvedEventId,
      sendNotifications: true,
    });

    return {
      status: "SUCCESS",
      action: "event_deleted",
      eventId: resolvedEventId,
      message: `✅ Event "${title || "event"}" deleted successfully`,
    };
  } catch (error) {
    return { status: "ERROR", message: `Failed to delete event: ${error.message}` };
  }
}

/**
 * List upcoming calendar events
 */
async function listEvents(calendar, { days = 7, maxResults = 10 }) {
  try {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: futureDate.toISOString(),
      maxResults: Math.min(maxResults, 250),
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = response.data.items || [];

    const eventList = events.map(event => ({
      id: event.id,
      summary: event.summary,
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      location: event.location || "",
      attendees: event.attendees ? event.attendees.length : 0,
    }));

    return {
      status: "SUCCESS",
      action: "events_listed",
      count: eventList.length,
      days,
      events: eventList,
      message: `Found ${eventList.length} upcoming events in the next ${days} days`,
    };
  } catch (error) {
    return { status: "ERROR", message: `Failed to list events: ${error.message}` };
  }
}

/**
 * Check availability and suggest available time slots
 */
async function checkAvailability(calendar, { participants = [], duration = 60, days = 7, searchDate }) {
  try {
    const now = new Date();
    const startDate = searchDate ? new Date(searchDate) : now;
    const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

    // Get busy times
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: endDate.toISOString(),
        items: [{ id: "primary" }, ...participants.map(p => ({ id: p }))],
      },
    });

    const busyTimes = response.data.calendars.primary.busy || [];

    // Find available slots
    const availableSlots = findAvailableSlots(startDate, endDate, busyTimes, duration);

    return {
      status: "SUCCESS",
      action: "availability_checked",
      availableSlots: availableSlots.slice(0, 5), // Return top 5 suggestions
      busyCount: busyTimes.length,
      message: `Found ${availableSlots.length} available time slots`,
    };
  } catch (error) {
    return { status: "ERROR", message: `Failed to check availability: ${error.message}` };
  }
}

/**
 * Helper: Parse date/time strings
 */
function parseDateTime(startStr, endStr) {
  let startDateTime = new Date();
  let endDateTime = new Date(startDateTime);

  if (startStr) {
    const lowerStr = startStr.toLowerCase();

    // Handle "tomorrow"
    if (lowerStr.includes("tomorrow")) {
      startDateTime = new Date();
      startDateTime.setDate(startDateTime.getDate() + 1);
      startDateTime.setHours(0, 0, 0, 0);
    }
    // Handle "next [day]"
    else if (lowerStr.includes("next")) {
      const dayMatch = startStr.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)/i);
      if (dayMatch) {
        startDateTime = new Date();
        startDateTime.setDate(startDateTime.getDate() + 1);
      }
    }
    // Handle specific dates like "18th Jan", "20th January", "3rd Feb"
    else if (/\d{1,2}(?:st|nd|rd|th)\s+(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)/i.test(startStr)) {
      const dateMatch = startStr.match(/(\d{1,2})(?:st|nd|rd|th)\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)/i);
      if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        const monthStr = dateMatch[2].toLowerCase().substring(0, 3); // Get first 3 chars: jan, feb, etc.
        const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        const month = months[monthStr];

        if (month !== undefined) {
          startDateTime = new Date();
          startDateTime.setMonth(month);
          startDateTime.setDate(day);
          startDateTime.setHours(0, 0, 0, 0);
        }
      }
    }
    // Handle explicit date formats (2026-01-18, 01/18/2026, etc.)
    else {
      try {
        const testDate = new Date(startStr);
        if (!isNaN(testDate.getTime())) {
          startDateTime = testDate;
        }
      } catch (e) {
        // Keep default
      }
    }

    // Extract time in various formats: "3:00 p.m.", "3:00pm", "3pm", "8:00 a.m.", "3pm"
    const timePatterns = [
      /(\d{1,2}):(\d{2})\s*(a\.m\.|am|a\.?m|p\.m\.|pm|p\.?m)/i,  // "3:00 p.m.", "3:00pm"
      /(\d{1,2})\s+(a\.m\.|am|a\.?m|p\.m\.|pm|p\.?m)/i,           // "3 p.m.", "3 pm"
      /(\d{1,2})(am|a\.m\.|a\.?m|pm|p\.m\.|p\.?m)/i               // "3pm", "3am" (no space)
    ];

    let timeMatched = false;
    for (const pattern of timePatterns) {
      const timeMatch = startStr.match(pattern);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        // For patterns with colon (pattern 1), minutes are in group 2
        const minutes = timeMatch[2] && !isNaN(parseInt(timeMatch[2])) ? parseInt(timeMatch[2]) : 0;
        // Meridiem is in the last captured group
        const meridiem = timeMatch[timeMatch.length - 1].toLowerCase();

        // Convert to 24-hour format
        if (meridiem.includes("p") && hours !== 12) hours += 12;
        if (meridiem.includes("a") && hours === 12) hours = 0;

        startDateTime.setHours(hours, minutes, 0, 0);
        timeMatched = true;
        break;
      }
    }

    // Default to 2 PM if no time specified but date was specified
    if (!timeMatched && startStr.length > 0) {
      startDateTime.setHours(14, 0, 0, 0);
    }
  }

  // Calculate end time
  endDateTime = new Date(startDateTime);
  if (endStr) {
    try {
      const testDate = new Date(endStr);
      if (!isNaN(testDate.getTime())) {
        endDateTime = testDate;
      } else {
        endDateTime.setHours(endDateTime.getHours() + 1);
      }
    } catch {
      endDateTime.setHours(endDateTime.getHours() + 1);
    }
  } else {
    endDateTime.setHours(endDateTime.getHours() + 1);
  }

  return { startDateTime, endDateTime };
}

/**
 * Helper: Find available time slots
 */
function findAvailableSlots(startDate, endDate, busyTimes, durationMinutes = 60) {
  const slots = [];
  const current = new Date(startDate);
  current.setHours(9, 0, 0, 0); // Start at 9 AM

  while (current < endDate) {
    const slotEnd = new Date(current.getTime() + durationMinutes * 60 * 1000);

    // Check if slot is free
    const isBusy = busyTimes.some(busy => {
      const busyStart = new Date(busy.start);
      const busyEnd = new Date(busy.end);
      return (current < busyEnd && slotEnd > busyStart);
    });

    if (!isBusy && current.getHours() < 18) { // Only suggest 9 AM - 6 PM
      slots.push({
        start: current.toISOString(),
        end: slotEnd.toISOString(),
        displayTime: current.toLocaleString(),
      });
    }

    current.setMinutes(current.getMinutes() + 30); // 30-minute increments
  }

  return slots;
}

/**
 * Helper: Find an event by title (searches upcoming events)
 */
async function findEventByTitle(calendar, searchTitle) {
  try {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // Search 30 days ahead

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: futureDate.toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = response.data.items || [];

    // Exact match first
    let match = events.find(e =>
      e.summary && e.summary.toLowerCase() === searchTitle.toLowerCase()
    );

    // If no exact match, try partial match
    if (!match) {
      match = events.find(e =>
        e.summary && e.summary.toLowerCase().includes(searchTitle.toLowerCase())
      );
    }

    return match || null;
  } catch (error) {
    console.error("Error searching for event:", error.message);
    return null;
  }
} 
