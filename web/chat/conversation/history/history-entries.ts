import { makeTextMessage } from "../messages/make-text-message.ts";
import { trimDisplay } from "../messages/trim-display.ts";
import { dateValue } from "../messages/date-value.ts";
import type { ConversationState, TranscriptMessage } from "../conversation-types.ts";
export function historyEntries(state: ConversationState) {
  const snapshot = state.session.snapshot;
  const messages = snapshot?.messages || [];
  const positions = new Map((snapshot?.messageEntryIds || []).map((id, index) => [id, index]));
  const entriesByPosition = new Map<number, TranscriptMessage[]>();
  const afterLive: TranscriptMessage[] = [];
  const add = (position: number | undefined, message: TranscriptMessage) => {
    if (position === undefined) return;
    const group = entriesByPosition.get(position) || [];
    group.push(message);
    entriesByPosition.set(position, group);
  };
  for (const entry of state.session.extensionUiRender?.entries || []) {
    if (!entry || entry.hidden === true || entry.visible === false || (!entry.node && typeof entry.text !== "string")) continue;
    const position = Object.hasOwn(entry, "beforeEntryId") ? entry.beforeEntryId === null ? messages.length : entry.beforeEntryId === undefined ? undefined : positions.get(entry.beforeEntryId)
      : Number.isSafeInteger(entry.position) && (entry.position ?? -1) >= 0 ? entry.position : messages.length;
    add(position, makeTextMessage(entry.node ? "" : trimDisplay(entry.text), `extension-entry-${entry.id}`, dateValue(entry.createdAt), "system", entry.node ? { extensionNode: entry.node } : {}));
  }
  for (const notification of state.session.extensionUi?.notifications || []) {
    if (notification.sessionId !== snapshot?.sessionId) continue;
    const rendered = makeTextMessage(notification.message, `extension-notification-${notification.id}`, new Date(notification.createdAt), "system", { extensionNotification: notification });
    if (notification.afterLive) { afterLive.push(rendered); continue; }
    if (Object.hasOwn(notification, "afterEntryId")) {
      const index = notification.afterEntryId === undefined ? undefined : positions.get(notification.afterEntryId);
      if (notification.afterEntryId !== null && index === undefined && !snapshot?.historyBefore && notification.position > messages.length) { afterLive.push(rendered); continue; }
      add(notification.afterEntryId === null ? snapshot?.historyBefore ? undefined : 0 : index === undefined ? undefined : index + 1, rendered);
    } else if (Number.isSafeInteger(notification.position)) {
      if (notification.position > messages.length) afterLive.push(rendered);
      else add(notification.position, rendered);
    }
  }
  for (const compaction of snapshot?.compactions || []) {
    const position = compaction.beforeEntryId === null ? messages.length : positions.get(compaction.beforeEntryId);
    add(position, makeTextMessage(compaction.summary, `compaction-${compaction.entryId}`, dateValue(null, 0), "system", { compaction }));
  }
  return { entriesByPosition, afterLive };
}
