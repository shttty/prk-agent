import type { UnknownSendEntry } from "../session-storage-types.ts";
import { MAX_TEXT } from "../session-storage-constants.ts";

const MAX_UNKNOWN_SENDS = 16;

/** Saved `[requestId, {text, streamId, unconfirmable?}]` pairs of sends whose result is still unknown. */
export function normalizeUnknownSends(value: unknown): UnknownSendEntry[] {
  if (!Array.isArray(value)) return [];
  const sends: UnknownSendEntry[] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || typeof entry[0] !== "string" || entry[0].length > 256) continue;
    const send: unknown = entry[1];
    if (typeof send !== "object" || send === null || !("text" in send) || !("streamId" in send)) continue;
    const { text, streamId } = send;
    if (typeof text !== "string" || text.length > MAX_TEXT || typeof streamId !== "string") continue;
    sends.push([entry[0], { text, streamId, ...("unconfirmable" in send && send.unconfirmable === true ? { unconfirmable: true as const } : {}) }]);
  }
  return sends.slice(-MAX_UNKNOWN_SENDS);
}
