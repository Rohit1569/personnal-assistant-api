import { google } from "googleapis";
import { getAuthorizedClient } from "./googleAuth.js";

/* ---------------- DATE PARSER ---------------- */

function resolveDateRange(input) {
  if (!input) return null;

  const now = new Date();

  if (input.toLowerCase() === "today") {
    const start = new Date(now.setHours(0, 0, 0, 0));
    const end = new Date(now.setHours(23, 59, 59, 999));
    return { start, end };
  }

  if (input.toLowerCase() === "tomorrow") {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const start = new Date(t.setHours(0, 0, 0, 0));
    const end = new Date(t.setHours(23, 59, 59, 999));
    return { start, end };
  }

  const parsed = new Date(input);
  if (isNaN(parsed)) return null;

  return { start: parsed, end: parsed };
}

/* ---------------- CALENDAR AGENT ---------------- */

export async function calendarAgent(details, userId, accessToken) {
  const auth = await getAuthorizedClient(userId);
  const calendar = google.calendar({ version: "v3", auth });

  const { action, title, start, end, eventId, updates } = details;

  try {
    /* -------- CREATE EVENT -------- */
    if (action === "create") {
      const range = resolveDateRange(start);
      if (!range) throw new Error("Invalid date");

      const event = {
        summary: title,
        start: { dateTime: range.start.toISOString() },
        end: { dateTime: range.end.toISOString() }
      };

      const res = await calendar.events.insert({
        calendarId: "primary",
        requestBody: event
      });

      return {
        status: "SUCCESS",
        message: `Event "${title}" created`
      };
    }

    /* -------- LIST EVENTS -------- */
    if (action === "list") {
      const range = resolveDateRange(start);

      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: range?.start?.toISOString(),
        timeMax: range?.end?.toISOString(),
        singleEvents: true,
        orderBy: "startTime"
      });

      return {
        status: "SUCCESS",
        events: res.data.items.map(e => ({
          id: e.id,
          title: e.summary,
          start: e.start?.dateTime || e.start?.date
        }))
      };
    }

    /* -------- UPDATE EVENT -------- */
    if (action === "update" && eventId) {
      const event = await calendar.events.get({
        calendarId: "primary",
        eventId
      });

      if (updates?.title) event.data.summary = updates.title;

      if (updates?.start) {
        const range = resolveDateRange(updates.start);
        event.data.start.dateTime = range.start.toISOString();
        event.data.end.dateTime = range.end.toISOString();
      }

      await calendar.events.update({
        calendarId: "primary",
        eventId,
        requestBody: event.data
      });

      return {
        status: "SUCCESS",
        message: "Event updated"
      };
    }

    /* -------- DELETE ONE EVENT -------- */
    if (action === "delete" && eventId) {
      await calendar.events.delete({
        calendarId: "primary",
        eventId
      });

      return {
        status: "SUCCESS",
        message: "Event deleted"
      };
    }

    /* -------- CANCEL ALL EVENTS (RANGE) -------- */
    if (action === "cancel_all") {
      const range = resolveDateRange(start);
      if (!range) throw new Error("Invalid date");

      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: range.start.toISOString(),
        timeMax: range.end.toISOString(),
        singleEvents: true
      });

      for (const event of res.data.items) {
        await calendar.events.delete({
          calendarId: "primary",
          eventId: event.id
        });
      }

      return {
        status: "SUCCESS",
        message: `Cancelled ${res.data.items.length} events`
      };
    }

    return {
      status: "UNSUPPORTED",
      message: "Unsupported calendar action"
    };

  } catch (err) {
    console.error("❌ Calendar agent error:", err.message);
    return {
      status: "ERROR",
      message: err.message
    };
  }
}
