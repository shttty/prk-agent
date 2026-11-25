import { clearFailure } from "../attention/clear-failure.ts";
import { attempt } from "./attempt.ts";
import type { HostContext } from "../host-types.ts";
import { requestCancel } from "../operations/request-cancel.ts";
import { discardInbox } from "../inbox/discard-inbox.ts";
import { discardQueued } from "../operations/discard-queued-input.ts";
import { injectDiscardNotice } from "../inbox/inject-discard-notice.ts";
import { emit } from "../subscriptions/publish-event.ts";
import { snapshotOperation } from "../snapshots/format-operation.ts";

export function close(ctx: HostContext): Promise<void> {
  if (ctx.closePromise) return ctx.closePromise;
  ctx.closing = true;
  ctx.state = "closing";
  clearFailure(ctx);
  const failures: unknown[] = [];
  const tryCleanup = (action: () => unknown) => attempt(failures, action);
  ctx.closePromise = Promise.resolve().then(async () => {
    await handoff;
    await closingHandlers;
    await tryCleanup(() => ctx.options.extensionUi?.cancel());
    if (ctx.active) requestCancel(ctx, ctx.active, "Recipient host closed.");
    if (ctx.active) await ctx.active.completion.promise;
    await Promise.allSettled([...ctx.lifecycleTasks]);
    await tryCleanup(() => ctx.session.abort());
    discardInbox(ctx, "Recipient host closed.");
    await tryCleanup(() => discardQueued(ctx, ctx.active, "Recipient host closed."));
    await tryCleanup(() => injectDiscardNotice(ctx));
    await tryCleanup(() => ctx.options.extensionUi?.dispose());
    await tryCleanup(() => ctx.options.dispose ? ctx.options.dispose() : ctx.session.dispose());
    ctx.unsubscribeSession!();
    ctx.unsubscribeKernel!();
    ctx.unsubscribeExtensionUi!();
    ctx.unsubscribeTerminals!();
    // Cleanup that could not be confirmed still ends the session; failureCount and the thrown error keep that fact.
    ctx.state = "closed";
    emit(ctx, "host_closed", { details: { failureCount: failures.length } });
    ctx.closed = true;
    ctx.listeners.clear();
    if (failures.length) throw new AggregateError(failures, "Session host shutdown failed; owned resources were still attempted.");
  });
  // Fence kernel callbacks before cancelling the SDK hooks, and keep the receipt writer alive.
  const handoff = tryCleanup(() => ctx.kernel?.prepareHandoff?.());
  const closingHandlers = tryCleanup(() => ctx.options.extensionHandlers?.close());
  emit(ctx, "state_changed", { details: { state: ctx.state, operation: snapshotOperation(ctx) ?? null } });
  return ctx.closePromise;
}
