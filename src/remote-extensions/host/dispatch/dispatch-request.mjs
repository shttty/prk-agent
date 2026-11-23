import { load } from "../extension-loading/load.mjs";
import { callback } from "./run-callback.mjs";
import { snapshot } from "./apply-session-snapshot.mjs";
import { shutdown } from "../shutdown.mjs";
import { decode } from "../../codec/decode.mjs";
import { unsupported } from "../../sdk-facade/reject-capability.mjs";

export async function request(ctx, frame) {
  if (ctx.incoming.has(frame.id)) throw new Error(`Duplicate remote request id: ${frame.id}`);
  ctx.incoming.add(frame.id);
  try {
    const data = decode(frame.payload);
    switch (frame.method) {
      case "load": return await load(ctx, data);
      case "execute": return await callback(ctx, frame.id, data, true);
      case "event": return await callback(ctx, frame.id, data, false);
      case "command": return await callback(ctx, frame.id, data, false, true);
      case "snapshot": return snapshot(ctx, ctx.generation, data);
      case "shutdown": return await shutdown(ctx, data?.reason);
      default: return unsupported(`request ${frame.method}`);
    }
  } finally {
    ctx.incoming.delete(frame.id);
  }
}
