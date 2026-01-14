export function extractIntent(text) {
  text = text.toLowerCase();

  if (text.includes("send mail to")) {
    const match = text.match(/send mail to (\S+)/i);
    return {
      action: "send_email",
      to: match ? match[1] : null,
      body: text,
    };
  }

  if (text.includes("book") || text.includes("meeting")) {
    return {
      action: "create_event",
      body: text,
    };
  }

  return { action: "unknown", body: text };
}
