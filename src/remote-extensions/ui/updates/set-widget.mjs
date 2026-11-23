import { queueUi } from "./queue-ui.mjs";

export function setWidget(ctx, owner, operation, key, content, options) {
  ctx.assertLive(owner);
  if (content === undefined || (Array.isArray(content) && content.every((line) => typeof line === "string"))) {
    queueUi(ctx, owner, operation, "setWidget", [key, content, options]);
  } else {
    ctx.warning("ui.setWidget(component)");
  }
}
