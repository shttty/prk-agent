import type { ConversationState } from "../conversation-types.ts";
export function hiddenThinkingLabel(state: ConversationState) {
  return state.session.extensionUi?.hiddenThinkingLabel ?? state.session.extensionUiRender?.hiddenThinkingLabel;
}
