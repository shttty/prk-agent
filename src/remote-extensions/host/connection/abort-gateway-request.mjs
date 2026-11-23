import { send } from "./send-frame.mjs";
import { encode } from "../../codec/encode.mjs";
import { asError } from "../normalize-error.mjs";

export function abortGatewayRequest(ctx, pending) {
  if (!ctx.reverse.has(pending.id)) return;
  const reason = asError(pending.options.signal?.reason ?? new Error("Remote UI request timed out"));
  try { send(ctx, { kind: "abort", id: pending.id, reason: encode(reason) }); } catch { /* Disconnect teardown owns pending calls. */ }
  if (pending.options.dialog) pending.finish(undefined, pending.options.defaultValue);
}
