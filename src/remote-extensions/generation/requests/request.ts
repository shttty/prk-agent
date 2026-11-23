import type { ExtensionToolContext } from "@earendil-works/pi-coding-agent";
import type { AgentToolUpdateCallback } from "@earendil-works/pi-agent-core";
import type { GenerationContext, RequestContext } from "../generation-types.ts";
import { encode } from "../../codec/encode.mjs";
import { send } from "../connection/send-frame.ts";
import { fail } from "../lifecycle/fail.ts";
import { errorOf } from "../connection/normalize-error.ts";
import { abortRequest } from "./abort-request.ts";
import { handleRequestAbort } from "./handle-request-abort.ts";
import { scheduleControlDeadline } from "./schedule-control-deadline.ts";
import { rejectRequest } from "./reject-request.ts";
import { resolveRequest } from "./resolve-request.ts";
import { trackUserWait } from "./track-user-wait.ts";

export function request(ctx: GenerationContext, method: string, payload: unknown, hooks: { ctx?: ExtensionToolContext; signal?: AbortSignal; update?: AgentToolUpdateCallback } = {}): Promise<unknown> {
  if (ctx.failure) return Promise.reject(ctx.failure);
  if (ctx.sendingFrame) return Promise.reject(Object.assign(new Error("Host frame transfer is busy"), { code: "BUSY", transient: true }));
  const encoded = encode(payload);
  const id = `gateway:${++ctx.serial}`;
  const result = Promise.withResolvers<unknown>();
  const call: RequestContext = {
    generation: ctx, id, method, hooks, result, userWaits: 0,
    onAbort: () => handleRequestAbort(call),
  };
  call.timer = scheduleControlDeadline(call);
  ctx.pending.set(id, {
    ...hooks, method, abort: (reason) => abortRequest(call, reason),
    resolve: (value) => { void sending.then(() => resolveRequest(call, value), () => {}); }, reject: (error) => rejectRequest(call, error),
    userWait: (start) => trackUserWait(call, start),
  });
  hooks.signal?.addEventListener("abort", call.onAbort, { once: true });
  // Queue initial abort after the request frame so the host has its controller.
  const sending = send(ctx, { kind: "request", id, method, payload: encoded });
  void sending.then(() => {
    if (hooks.signal?.aborted) call.onAbort();
  }, (error: unknown) => {
    if (error instanceof Error && "code" in error && (error.code === "BUSY" || error.code === "FRAME_TOO_LARGE")) rejectRequest(call, error);
    else fail(ctx, errorOf(error));
  });
  return result.promise;
}
