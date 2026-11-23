import { context } from "../sdk-context/create-context.mjs";
import { flushUi } from "../ui/flush-ui.mjs";
import { asError } from "./normalize-error.mjs";

export function shutdown(ctx, reason = "quit") {
  if (ctx.shutdownPromise) return ctx.shutdownPromise;
  const owner = ctx.generation;
  if (!owner) return Promise.resolve({ stopped: true });
  ctx.memoryTelemetry?.stop();
  owner.phase = "closing";
  ctx.shutdownPromise = (async () => {
    const abortReason = new Error(`Remote extension shutdown: ${reason}`);
    for (const operation of ctx.active.values()) operation.controller.abort(abortReason);
    for (const controller of owner.commandsInFlight.keys()) controller.abort(abortReason);
    for (const pending of [...ctx.reverse.values()]) pending.finish(abortReason);
    const failures = [];
    try {
      await Promise.allSettled([...ctx.active.values()].map((operation) => operation.promise));
      await Promise.allSettled(owner.commandsInFlight.values());
      for (const registration of owner.handlers.values()) {
        if (!registration.enabled || registration.event !== "session_shutdown") continue;
        const operation = { id: `shutdown:${registration.handlerId}`, owner, controller: new AbortController(), hasSignal: false, ui: new Set(), finished: false };
        try {
          await registration.handler({ type: "session_shutdown", reason }, context(ctx, owner, operation));
        } catch (error) {
          failures.push(asError(error));
        } finally {
          try { await flushUi(ctx, operation); } catch (error) { failures.push(asError(error)); }
          operation.finished = true;
        }
      }
    } finally {
      owner.phase = "closed";
      for (const pending of [...ctx.reverse.values()]) pending.finish(abortReason);
      owner.tools.clear();
      owner.nativeDefinitions.clear();
      owner.handlers.clear();
      owner.projectRunner?.invalidate("Remote extension generation is closed");
      owner.events.clear();
    }
    if (failures.length) throw new AggregateError(failures, `Remote session_shutdown handlers failed: ${failures.map((error) => error.message).join("; ")}`);
    return { stopped: true };
  })();
  return ctx.shutdownPromise;
}
