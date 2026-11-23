import { assertLive } from "../assert-live.mjs";
import { respond } from "./respond.mjs";
import { send } from "../connection/send-frame.mjs";
import { encode } from "../../codec/encode.mjs";
import { decode } from "../../codec/decode.mjs";
import { asError } from "../normalize-error.mjs";

export function receive(ctx, frame) {
  if (!frame || typeof frame !== "object" || Array.isArray(frame) || typeof frame.id !== "string" || !frame.id) throw new TypeError("Invalid remote extension frame");
  if (frame.kind === "request") {
    void respond(ctx, frame).catch(ctx.disconnect);
  } else if (frame.kind === "reply") {
    const pending = ctx.reverse.get(frame.id);
    if (!pending) return;
    assertLive(ctx, pending.owner);
    if (Object.hasOwn(frame, "result") === Object.hasOwn(frame, "error")) throw new TypeError("Remote reply requires exactly one result or error");
    if (Object.hasOwn(frame, "error")) {
      const error = decode(frame.error);
      if (!(error instanceof Error)) throw new TypeError("Remote reply error must encode Error");
      pending.finish(error);
    } else {
      pending.finish(undefined, decode(frame.result));
    }
  } else if (frame.kind === "update") {
    const pending = ctx.reverse.get(frame.id);
    if (!pending) return;
    assertLive(ctx, pending.owner);
    try { pending.onUpdate?.(decode(frame.payload)); } catch (error) {
      send(ctx, { kind: "abort", id: frame.id, reason: encode(asError(error)) });
      pending.finish(asError(error));
    }
  } else if (frame.kind === "abort") {
    const reason = decode(frame.reason);
    if (!(reason instanceof Error)) throw new TypeError("Remote abort must encode Error");
    ctx.active.get(frame.id)?.controller.abort(reason);
    send(ctx, { kind: "abort_ack", id: frame.id });
  } else {
    throw new TypeError(`Unknown remote extension frame kind: ${frame.kind}`);
  }
}
