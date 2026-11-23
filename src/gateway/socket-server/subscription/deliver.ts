import type { SessionSubscriptionContext } from "./subscription-state.ts";
import type { SessionHostEvent } from "../../../sessions/host/host-types.ts";
import { writeFrame } from "../../socket-channel/write-frame.ts";

export function deliver(ctx: SessionSubscriptionContext, event: SessionHostEvent): void {
  if (event.type === "snapshot"
    ? event.streamId !== ctx.streamId || ctx.boundary === undefined || event.sequence >= ctx.boundary
    : event.streamId === ctx.streamId && ctx.boundary !== undefined && event.sequence > ctx.boundary) {
    ctx.streamId = event.streamId;
    ctx.boundary = event.sequence;
    writeFrame(ctx.socket, { v: 1, sessionId: ctx.sessionId, event }, ctx.limits.outputBytes, ctx.limits.outputBytes);
  }
}
