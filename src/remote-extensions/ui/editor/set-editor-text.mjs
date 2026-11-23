import { queueUi } from "../updates/queue-ui.mjs";

export function setEditorText(ctx, owner, operation, text) {
  return queueUi(ctx, owner, operation, "setEditorText", [text]);
}
