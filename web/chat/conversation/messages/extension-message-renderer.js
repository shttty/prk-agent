import { isRecord } from "../../../workbench/payloads/is-record.js";
export function extensionMessageRenderer(state, index) {
  const entryId = state?.session?.snapshot?.messageEntryIds?.[index];
  const value = entryId ? state.session.extensionUiRender?.messages?.[entryId] : undefined;
  if (!isRecord(value) || value.hidden === true || value.visible === false) return null;
  return value;
}
