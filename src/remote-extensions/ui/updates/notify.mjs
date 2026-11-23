import { queueUi } from "./queue-ui.mjs";

export function notify(ctx, owner, operation, ...args) {
  return queueUi(ctx, owner, operation, "notify", args);
}
