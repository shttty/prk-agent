import { queueUi } from "./queue-ui.mjs";

export function setStatus(ctx, owner, operation, ...args) {
  return queueUi(ctx, owner, operation, "setStatus", args);
}
