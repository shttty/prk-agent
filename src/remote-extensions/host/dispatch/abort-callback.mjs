import { send } from "../connection/send-frame.mjs";
import { encode } from "../../codec/encode.mjs";
import { asError } from "../normalize-error.mjs";

export function onAbort(ctx, operation, tool, rejectAbort) {
  const reason = asError(operation.controller.signal.reason);
  for (const [reverseId, pending] of tool ? [] : [...ctx.reverse]) {
    if (pending.parentId !== operation.id) continue;
    send(ctx, { kind: "abort", id: reverseId, reason: encode(reason) });
    pending.finish(reason);
  }
  rejectAbort(reason);
}
