import type { PeerContext, Respond } from "../connection/peer-state.ts";
import { WireError } from "../../wire/create-error.ts";
import { failure } from "../../wire/serialize-failure.ts";
import { object } from "../../wire/is-record.ts";
import { validateRequest } from "../../wire/validate-request.ts";
import { writeFrame } from "../../socket-channel/write-frame.ts";
import { dispatchRequest } from "../dispatch/dispatch-request.ts";

export function receiveRequest(ctx: PeerContext, respond: Respond, value: unknown): void {
  const { socket } = ctx;
  const { gateway, limits } = ctx.listener;
  const id = object(value) && Number.isSafeInteger(value.id) && (value.id as number) > 0 ? value.id as number : null;
  try {
    if (id !== null) {
      if (id <= ctx.lastId) throw new WireError("DUPLICATE_ID", "Request IDs must strictly increase on this connection; never replay.");
      ctx.lastId = id;
    }
    const request = validateRequest(value, limits);
    if (ctx.pending >= gateway.pendingMax) throw new WireError("BUSY", "Too many outstanding requests.");
    ctx.pending += 1;
    void dispatchRequest(ctx, respond, request).catch((error) => writeFrame(socket, failure(id, error), limits.outputBytes, limits.outputBytes)).finally(() => { ctx.pending -= 1; });
  } catch (error) { writeFrame(socket, failure(id, error), limits.outputBytes, limits.outputBytes); }
}
