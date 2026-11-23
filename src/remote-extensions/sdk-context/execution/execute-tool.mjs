import { unsupported } from "../../sdk-facade/reject-capability.mjs";

export function executeTool(ctx, owner, operation, name, args, options = {}) {
  ctx.assertRunning(owner);
  if (operation.finished || ctx.active.get(operation.id) !== operation) throw new Error("Remote executeTool requires its active parent tool call");
  for (const key of Object.keys(options)) if (key !== "signal" && key !== "onUpdate") unsupported(`executeTool options.${key}`);
  const signal = options.signal ?? operation.controller.signal;
  return ctx.reverseRequest(owner, operation.id, "executeTool", { name, args, aborted: signal.aborted }, {
    signal,
    onUpdate: options.onUpdate,
  });
}
