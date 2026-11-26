import type { ConversationState } from "./conversation-types.ts";
export function isBusy(state: ConversationState) {
  const snapshot = state.session.snapshot;
  return Boolean(snapshot?.operation || snapshot?.state === "running" || snapshot?.state === "cancel_requested");
}
