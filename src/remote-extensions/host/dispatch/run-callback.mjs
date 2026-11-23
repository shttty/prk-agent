import { assertRunning } from "../assert-running.mjs";
import { snapshot } from "./apply-session-snapshot.mjs";
import { context } from "../../sdk-context/create-context.mjs";
import { flushUi } from "../../ui/flush-ui.mjs";
import { onAbort } from "./abort-callback.mjs";
import { onUpdate } from "./publish-tool-update.mjs";

export async function callback(ctx, id, data, tool, command = false) {
  const owner = ctx.generation;
  assertRunning(ctx, owner);
  snapshot(ctx, owner, data.snapshot);
  const registration = command ? owner.commandHandlers.get(data.name) : tool ? owner.tools.get(data.toolId) : owner.handlers.get(data.handlerId);
  if (!registration) throw new Error(`Unknown remote ${command ? "command" : tool ? "tool" : "handler"} id`);
  if (!tool && !command && data.event?.type !== registration.event) throw new Error("Remote handler event mismatch");
  if (!tool && !command && registration.event === "session_shutdown") throw new Error("session_shutdown is dispatched by shutdown, not event");
  const operation = {
    id, owner, controller: new AbortController(), ui: new Set(), finished: false,
    hasSignal: true, command,
  };
  if (data.aborted) operation.controller.abort(new Error("Remote callback was already aborted"));
  ctx.active.set(id, operation);
  const signal = operation.controller.signal;
  let rejectAbort;
  const aborted = new Promise((_resolve, reject) => { rejectAbort = reject; });
  // Tools keep Pi's native executor cancellation; handlers cannot keep a stopped turn open.
  void aborted.catch(() => {});
  const abort = onAbort.bind(undefined, ctx, operation, tool, rejectAbort);
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const run = (async () => {
    try {
      const callbackContext = context(ctx, owner, operation, tool);
      if (command) {
        if (typeof data.args !== "string") throw new TypeError("command requires string args");
        signal.throwIfAborted();
        return await Promise.race([Promise.resolve().then(() => registration(data.args, callbackContext)), aborted]);
      }
      if (tool) {
        if (typeof data.toolCallId !== "string") throw new TypeError("execute requires toolCallId");
        const update = onUpdate.bind(undefined, ctx, owner, operation);
        return await registration.definition.execute(data.toolCallId, data.args, operation.controller.signal, update, callbackContext);
      }
      const event = data.event;
      if (["session_before_compact", "session_before_tree"].includes(registration.event)) event.signal = operation.controller.signal;
      let result;
      if (registration.enabled) {
        signal.throwIfAborted();
        result = await Promise.race([Promise.resolve().then(() => registration.handler(event, callbackContext)), aborted]);
      }
      if (Object.hasOwn(event, "signal")) delete event.signal;
      return { result, event };
    } finally {
      signal.removeEventListener("abort", abort);
      try { await flushUi(ctx, operation); } finally { operation.finished = true; ctx.active.delete(id); }
    }
  })();
  operation.promise = run;
  return run;
}
