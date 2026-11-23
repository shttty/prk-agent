import type { ProcessWindowState } from "./window-state.ts";

export function reserve(ctx: ProcessWindowState, id: number, bytes: number, control?: string): void {
  if (ctx.retired) throw Object.assign(new Error("Process generation retired; outcome unknown"), { code: "unknown" });
  if (!Number.isSafeInteger(id) || id < 0 || !Number.isSafeInteger(bytes) || bytes <= 0 || ctx.pending.has(id)) {
    throw Object.assign(new Error("Invalid process request id or byte size"), { code: "INVALID_REQUEST" });
  }
  if (bytes > ctx.ordinaryLimits.maxFrameBytes) {
    throw Object.assign(new Error("Process frame exceeds byte limit"), { code: "FRAME_TOO_LARGE" });
  }
  if (control !== undefined) {
    const slot = ctx.controls?.get(control);
    if (!slot) throw Object.assign(new Error(`No process window reserve for ${control}`), { code: "INVALID_REQUEST" });
    if (bytes > slot.maxBytes) {
      throw Object.assign(new Error(`Process ${control} frame exceeds reserved byte limit (${slot.maxBytes})`), { code: "FRAME_TOO_LARGE" });
    }
    if (slot.bytes !== 0) {
      throw Object.assign(new Error(`Process ${control} reserve is full`), { code: "BUSY", transient: true });
    }
    slot.bytes = bytes;
    ctx.pending.set(id, slot);
    return;
  }
  if (ctx.ordinaryRequests >= ctx.ordinaryLimits.maxRequests || bytes > ctx.ordinaryLimits.maxBytes - ctx.ordinaryBytes) {
    throw Object.assign(new Error("Process consumption window is full"), { code: "BUSY", transient: true });
  }
  ctx.pending.set(id, bytes);
  ctx.ordinaryRequests++;
  ctx.ordinaryBytes += bytes;
}
