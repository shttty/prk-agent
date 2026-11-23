import { queueUi } from "./queue-ui.mjs";

export function setTitle(ctx, owner, operation, ...args) {
  return queueUi(ctx, owner, operation, "setTitle", args);
}
