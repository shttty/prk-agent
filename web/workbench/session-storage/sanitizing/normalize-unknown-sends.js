import { MAX_TEXT } from "../session-storage-constants.js";
const MAX_UNKNOWN_SENDS = 16;
/** Saved `[requestId, {text, streamId, unconfirmable?}]` pairs of sends whose result is still unknown. */
export function normalizeUnknownSends(value) {
  return Array.isArray(value)
    ? value.filter((entry) => Array.isArray(entry) && typeof entry[0] === "string" && entry[0].length <= 256
      && typeof entry[1]?.text === "string" && entry[1].text.length <= MAX_TEXT && typeof entry[1].streamId === "string")
      .slice(-MAX_UNKNOWN_SENDS)
      .map(([requestId, entry]) => [requestId, { text: entry.text, streamId: entry.streamId, ...(entry.unconfirmable === true ? { unconfirmable: true } : {}) }])
    : [];
}
