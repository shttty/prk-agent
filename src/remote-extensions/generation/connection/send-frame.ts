import type { Frame, GenerationContext } from "../generation-types.ts";
import { rawChunkBytes } from "../../../target-channel/request-budget/raw-chunk-bytes.ts";
import LIMITS from "../../../target-channel/target-extensions/extension-limits.json" with { type: "json" };
import { fail } from "../lifecycle/fail.ts";
import { errorOf } from "./normalize-error.ts";

export async function send(ctx: GenerationContext, frame: Frame): Promise<void> {
  while (ctx.sendingFrame) await ctx.sendingFrame;
  if (ctx.failure) throw ctx.failure;
  const data = Buffer.from(JSON.stringify(frame));
  if (data.length > LIMITS.MAX_FRAME_BYTES) throw Object.assign(new Error("Host frame exceeds byte limit"), { code: "FRAME_TOO_LARGE" });
  const finished = Promise.withResolvers<void>();
  ctx.sendingFrame = finished.promise;
  try {
    for (let offset = 0; offset < data.length;) {
      if (ctx.failure) throw ctx.failure;
      const fields = { generation: ctx.generation, total: data.length, offset, last: false };
      const length = rawChunkBytes(ctx.lease.processWindow, "remoteExtensions", "frameChunk", fields, data.length - offset);
      await ctx.lease.request("remoteExtensions", "frameChunk", {
        ...fields, last: offset + length === data.length, data: data.subarray(offset, offset + length).toString("base64"),
      });
      offset += length;
    }
  } catch (error) {
    fail(ctx, errorOf(error));
    throw error;
  } finally {
    ctx.sendingFrame = undefined;
    finished.resolve();
  }
}
