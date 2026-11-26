import { dequal } from "dequal";
import type { TranscriptMessage } from "./conversation-types.ts";
/**
 * Projection builds fresh message objects on every input change. Hand back the previous object of every message whose
 * projection is unchanged (and the previous array when nothing changed), so assistant-ui keeps its message state and
 * only the changed message (in practice the live turn) re-renders.
 */
export function reuseUnchangedMessages(previous: TranscriptMessage[], next: TranscriptMessage[]): TranscriptMessage[] {
  const byId = new Map(previous.map((message) => [message.id, message]));
  const stable = next.map((message) => {
    const old = byId.get(message.id);
    return old && dequal(old, message) ? old : message;
  });
  return stable.length === previous.length && stable.every((message, index) => message === previous[index]) ? previous : stable;
}
