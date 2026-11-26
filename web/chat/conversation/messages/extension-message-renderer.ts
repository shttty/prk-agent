import { isPayload } from "../../payload/is-payload.ts";
import type { ConversationState, ExtensionMessageRender } from "../conversation-types.ts";
export function extensionMessageRenderer(state: ConversationState, index: number): ExtensionMessageRender | null {
  const entryId = state.session.snapshot?.messageEntryIds?.[index];
  const value = entryId ? state.session.extensionUiRender?.messages?.[entryId] : undefined;
  if (!isPayload(value) || value.hidden === true || value.visible === false) return null;
  return value;
}
