/** The JSON of a server-sent event, or null when the event carries none or it does not parse. */
export function parseEvent(event: Event): unknown {
  if (!(event instanceof MessageEvent) || typeof event.data !== "string") return null;
  try { return JSON.parse(event.data); } catch { return null; }
}
