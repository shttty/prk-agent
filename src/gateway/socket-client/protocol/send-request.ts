import type { ClientContext } from "../client-state.ts";
import { WireError } from "../../wire/create-error.ts";
import { validateRequest } from "../../wire/validate-request.ts";
import type { Method } from "../../wire/wire-types.ts";
import { writeFrame } from "../../socket-channel/write-frame.ts";

export function sendRequest(ctx: ClientContext, lose: () => void, method: Method, params: Record<string, unknown>, requestTimeoutMs: number): Promise<unknown> {
  const { socket, gateway, limits, pending } = ctx;
  if (ctx.lost) return Promise.reject(new WireError("CLIENT_ERROR","Gateway is disconnected; reconnect explicitly. No request was sent."));
  if (pending.size >= gateway.pendingMax) return Promise.reject(new WireError("CLIENT_ERROR","Too many pending client requests; no request was sent."));
  if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs <= 0 || requestTimeoutMs > 2_147_483_647) return Promise.reject(new WireError("CLIENT_ERROR", "Invalid request timeout; no request was sent."));
  const id = ++ctx.counter;
  const request = validateRequest({ v: 1, id, method, params }, limits);
  if (Buffer.byteLength(JSON.stringify(request)) + 1 > limits.inputBytes) return Promise.reject(new WireError("CLIENT_ERROR","Request exceeds byte limit; not sent."));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(lose, requestTimeoutMs);
    pending.set(id, { resolve, reject, timer });
    if (!writeFrame(socket, request, limits.inputBytes, limits.outputBytes)) lose();
  });
}
