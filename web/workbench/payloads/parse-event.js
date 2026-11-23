
export function parseEvent(event) {
  try { return JSON.parse(event.data); } catch { return null; }
}

