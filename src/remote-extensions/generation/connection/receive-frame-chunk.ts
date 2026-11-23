import type { TargetEvent } from "../../../target-channel/channels/channel-types.ts";
import type { Frame, GenerationContext } from "../generation-types.ts";
import LIMITS from "../../../target-channel/target-extensions/extension-limits.json" with { type: "json" };
import { receive } from "./receive-frame.ts";
import { fail } from "../lifecycle/fail.ts";
import { errorOf } from "./normalize-error.ts";

export function receiveFrameChunk(ctx: GenerationContext, event: TargetEvent): void {
  if (ctx.failure || event.generation !== ctx.generation) return;
  const { total, offset, last, data } = event;
  try {
    if (typeof total !== "number" || !Number.isSafeInteger(total) || total < 1 || total > LIMITS.MAX_FRAME_BYTES
      || typeof offset !== "number" || !Number.isSafeInteger(offset) || offset < 0 || offset >= total
      || typeof last !== "boolean" || typeof data !== "string") throw new Error("Invalid host frame chunk");
    const bytes = Buffer.from(data, "base64");
    if (!bytes.length || bytes.toString("base64") !== data || offset + bytes.length > total) throw new Error("Invalid host chunk bytes");
    if (!ctx.incomingFrame) {
      if (offset !== 0) throw new Error("Host frame must begin at offset zero");
      ctx.incomingFrame = { buffer: Buffer.allocUnsafe(total), offset: 0 };
    }
    const current = ctx.incomingFrame;
    if (current.buffer.length !== total || current.offset !== offset || last !== (offset + bytes.length === total)) {
      throw new Error("Host frame chunk is out of order");
    }
    bytes.copy(current.buffer, offset);
    current.offset += bytes.length;
    if (last) {
      ctx.incomingFrame = undefined;
      const frame: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(current.buffer));
      if (!frame || typeof frame !== "object" || Array.isArray(frame)
        || typeof Reflect.get(frame, "kind") !== "string" || typeof Reflect.get(frame, "id") !== "string") throw new Error("Invalid host frame");
      ctx.options.onEvent?.({ mod: "remoteExtensions", t: "frame", generation: ctx.generation, frame });
      void receive(ctx, frame as Frame).catch((error) => fail(ctx, errorOf(error)));
    }
  } catch (error) {
    ctx.incomingFrame = undefined;
    throw error;
  }
}
