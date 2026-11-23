import type { RequestContext } from "../generation-types.ts";
import { encode } from "../../codec/encode.mjs";
import { fail } from "../lifecycle/fail.ts";
import { publishMonitor } from "../telemetry/publish-monitor.ts";
import { send } from "../connection/send-frame.ts";
import { errorOf } from "../connection/normalize-error.ts";
import { settleRequest } from "./settle-request.ts";

export function abortRequest(ctx: RequestContext, reason: Error): void {
  const owner = ctx.generation;
  if (!owner.pending.has(ctx.id)) return;
  if (!owner.abortAcks.has(ctx.id)) {
    const timer = setTimeout(() => {
      owner.abortAcks.delete(ctx.id);
      if (owner.failure) return;
      const replace = !owner.closing;
      fail(owner, new Error("Remote extension abort acknowledgement timed out; in-flight outcome is unknown, request was not replayed."));
      if (replace && owner.options.onFrozen) {
        publishMonitor(owner, "replacing");
        void owner.options.onFrozen(owner).catch((error) => {
          publishMonitor(owner, "failed", errorOf(error));
          owner.options.onError?.(errorOf(error));
          console.error("[remote-extension] frozen host replacement failed:", error);
        });
      }
    }, owner.options.hostOptions?.abortTimeoutMs ?? 5000);
    owner.abortAcks.set(ctx.id, timer);
  }
  void send(owner, { kind: "abort", id: ctx.id, reason: encode(reason) }).catch((error) => fail(owner, errorOf(error)));
  // Pi owns the error policy: block tool_call, retain tool_result, report other handler errors.
  if (ctx.method === "event") settleRequest(ctx, reason);
}
