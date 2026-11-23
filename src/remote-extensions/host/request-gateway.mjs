import { assertLive } from "./assert-live.mjs";
import { send } from "./connection/send-frame.mjs";
import { encode } from "../codec/encode.mjs";
import { asError } from "./normalize-error.mjs";
import { settleGatewayRequest } from "./connection/settle-gateway-request.mjs";
import { abortGatewayRequest } from "./connection/abort-gateway-request.mjs";

export function reverseRequest(ctx, owner, parentId, method, payload, options = {}) {
  assertLive(ctx, owner);
  if (options.signal?.aborted && options.dialog) return Promise.resolve(options.defaultValue);
  const id = `node:${++ctx.sequence}`;
  return new Promise((resolve, reject) => {
    const pending = { id, options, resolve, reject, timer: undefined, finish: undefined, abort: undefined };
    pending.finish = settleGatewayRequest.bind(undefined, ctx, pending);
    pending.abort = abortGatewayRequest.bind(undefined, ctx, pending);
    ctx.reverse.set(id, { owner, parentId, finish: pending.finish, onUpdate: options.onUpdate, abort: pending.abort });
    options.signal?.addEventListener("abort", pending.abort, { once: true });
    if (options.dialog && options.timeout) pending.timer = setTimeout(pending.abort, options.timeout);
    try {
      send(ctx, { kind: "request", id, method, parentId, payload: encode(payload) });
      if (options.signal?.aborted) pending.abort();
    } catch (error) {
      pending.finish(asError(error));
    }
  });
}
