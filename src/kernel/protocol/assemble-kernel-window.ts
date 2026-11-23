import { createProcessWindow } from "../../target-environment/process-window/assemble-window.ts";
import type { ProcessWindow, ProcessWindowLimits } from "../../target-environment/process-window/window-state.ts";
import { callbackReplyChunk } from "./callback-reply-chunk.ts";
import { encodeCommand } from "./encode-command.ts";

export type KernelControl = "cancel" | "callback_reply_chunk";

export function createKernelWindow(limits: ProcessWindowLimits, generation: string, chunkBytes: number): ProcessWindow<KernelControl> {
  // UUIDs are fixed-width ASCII, and both request IDs are positive safe integers.
  const cellId = "ffffffff-ffff-4fff-bfff-ffffffffffff";
  const maxId = Number.MAX_SAFE_INTEGER;
  const cancel = encodeCommand(generation, maxId, { kind: "cancel", cellId });
  // `false` is the longer final flag. Base64 adds no JSON escaping and pads to a multiple of four.
  const chunk = encodeCommand(generation, maxId, callbackReplyChunk(cellId, maxId, "", false));
  return createProcessWindow(limits, {
    cancel: Buffer.byteLength(cancel),
    callback_reply_chunk: Buffer.byteLength(chunk) + 4 * Math.ceil(chunkBytes / 3),
  });
}
