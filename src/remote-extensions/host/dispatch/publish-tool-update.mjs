import { assertLive } from "../assert-live.mjs";
import { send } from "../connection/send-frame.mjs";
import { encode } from "../../codec/encode.mjs";

export function onUpdate(ctx, owner, operation, partial) {
  assertLive(ctx, owner);
  if (operation.finished || ctx.active.get(operation.id) !== operation) throw new Error("Stale remote tool update callback");
  send(ctx, { kind: "update", id: operation.id, payload: encode(partial) });
}
